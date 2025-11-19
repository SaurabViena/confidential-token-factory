"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { readContract, writeContract } from "@wagmi/core";
import { wagmiConfig } from "@/app/providers";
import { TokenFactoryABI, ConfidentialMintableTokenABI } from "@/config/abi/index";
import { getZamaInstance } from "@/lib/zama";
import Link from "next/link";
import Image from "next/image";

interface TokenInfo {
  token: string;
  creator: string;
  name: string;
  symbol: string;
  description: string;
  iconCid: string;
  maxSupply: bigint;
  creatorReserveBps: number;
  publicMintBps: number;
  perMintAmount: bigint;
  perWalletMintLimit: number;
  publicAllocation: bigint;
}

type Notice = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
};

function isZeroBytes(value: string): boolean {
  if (typeof value !== "string") return false;
  const hex = value.toLowerCase();
  if (!hex.startsWith("0x")) return false;
  for (let i = 2; i < hex.length; i++) {
    if (hex[i] !== "0") return false;
  }
  return true;
}

function toDisplayString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "bigint") return v.toString();
  if (v == null) return "";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default function DashboardPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [sendPending, setSendPending] = useState<Record<string, boolean>>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [toMap, setToMap] = useState<Record<string, string>>({});
  const [amountMap, setAmountMap] = useState<Record<string, string>>({});
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("");

  const addNotice = (n: Notice) => {
    setNotices((prev) => [n, ...prev]);
    if (n.type === "success") {
      setTimeout(() => {
        setNotices((prev) => prev.filter((x) => x.id !== n.id));
      }, 1000);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!address) {
      setLoading(true);
      setTokens([]);
      setSelectedTokenAddress("");
      return;
    }

    const fetchTokens = async () => {
      setLoading(true);
      try {
        const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`;
        const count = await readContract(wagmiConfig, {
          address: factoryAddress,
          abi: TokenFactoryABI,
          functionName: "getTokensCount",
        }) as bigint;

        await getZamaInstance().catch(() => undefined);

        const allTokens: TokenInfo[] = [];
        for (let i = 0; i < Number(count); i++) {
          const tokenInfo = await readContract(wagmiConfig, {
            address: factoryAddress,
            abi: TokenFactoryABI,
            functionName: "getTokenInfo",
            args: [BigInt(i)],
          }) as {
            token: string;
            creator: string;
            name: string;
            symbol: string;
            description: string;
            iconCid: string;
            maxSupply: bigint;
            creatorReserveBps: number;
            publicMintBps: number;
            perMintAmount: bigint;
            perWalletMintLimit: number;
            publicAllocation: bigint;
          };

          const isCreator = tokenInfo.creator.toLowerCase() === address.toLowerCase();

          let hasMinted = false;
          try {
            const mintCount = await readContract(wagmiConfig, {
              address: tokenInfo.token as `0x${string}`,
              abi: ConfidentialMintableTokenABI,
              functionName: "walletMintCount",
              args: [address],
            }) as number;
            hasMinted = Number(mintCount) > 0;
          } catch (checkError) {
            console.error(`Failed to check mint record for token ${tokenInfo.token}:`, checkError);
          }

          let hasBalance = false;
          try {
            const balanceHandle = await readContract(wagmiConfig, {
              address: tokenInfo.token as `0x${string}`,
              abi: ConfidentialMintableTokenABI,
              functionName: "confidentialBalanceOf",
              args: [address],
            }) as `0x${string}`;
            hasBalance = !isZeroBytes(balanceHandle);
            if (isZeroBytes(balanceHandle)) {
              setBalances((b) => ({ ...b, [tokenInfo.token]: "0" }));
            }
          } catch (balanceErr) {
            console.error(`Failed to read confidential balance handle for token ${tokenInfo.token}:`, balanceErr);
          }

          if (isCreator || hasMinted || hasBalance) {
            allTokens.push({
              token: tokenInfo.token,
              creator: tokenInfo.creator,
              name: tokenInfo.name,
              symbol: tokenInfo.symbol,
              description: tokenInfo.description,
              iconCid: tokenInfo.iconCid,
              maxSupply: tokenInfo.maxSupply,
              creatorReserveBps: tokenInfo.creatorReserveBps,
              publicMintBps: tokenInfo.publicMintBps,
              perMintAmount: tokenInfo.perMintAmount,
              perWalletMintLimit: tokenInfo.perWalletMintLimit,
              publicAllocation: tokenInfo.publicAllocation,
            });
          }
        }
        setTokens(allTokens);
        if (allTokens.length > 0 && !selectedTokenAddress) {
          setSelectedTokenAddress(allTokens[0].token);
        }
      } catch (error) {
        console.error("Failed to load tokens:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [address, mounted, selectedTokenAddress]);

  const onQueryBalance = useMemo(() => {
    return (tokenAddress: string) => {
      if (!address) return;
      if (pending[tokenAddress]) return;
      setPending((p) => ({ ...p, [tokenAddress]: true }));
      (async () => {
        try {
          const handle = await readContract(wagmiConfig, {
            address: tokenAddress as `0x${string}`,
            abi: ConfidentialMintableTokenABI,
            functionName: "confidentialBalanceOf",
            args: [address],
          }) as `0x${string}`;

          if (isZeroBytes(handle)) {
            setBalances((b) => ({ ...b, [tokenAddress]: "0" }));
            addNotice({ id: `${tokenAddress}-zero`, type: "success", title: "Balance is 0 (no decryption needed)" });
            return;
          }

          const inst = (await getZamaInstance()) as unknown as Record<string, unknown>;
          const instance = inst as unknown as {
            generateKeypair: () => { publicKey: string; privateKey: string };
            createEIP712: (
              publicKey: string,
              contractAddresses: string[],
              startTimeStamp: string,
              durationDays: string
            ) => { domain: unknown; types: { UserDecryptRequestVerification: { name: string; type: string }[] }; message: unknown };
            userDecrypt: (
              pairs: { handle: string; contractAddress: string }[],
              privateKey: string,
              publicKey: string,
              signatureNo0x: string,
              contractAddresses: string[],
              userAddress: string,
              startTimeStamp: string,
              durationDays: string
            ) => Promise<Record<string, unknown>>;
          };

          if (!walletClient) {
            addNotice({ id: `${tokenAddress}-nw`, type: "error", title: "Wallet not connected or does not support signing" });
            return;
          }

          const keypair = instance.generateKeypair();
          const contractAddresses = [tokenAddress];
          const startTimeStamp = String(Math.floor(Date.now() / 1000));
          const durationDays = "10";

          const eip712 = instance.createEIP712(
            keypair.publicKey,
            contractAddresses,
            startTimeStamp,
            durationDays
          );

          const signParams = {
            account: address,
            domain: eip712.domain,
            types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
            primaryType: "UserDecryptRequestVerification",
            message: eip712.message,
          } as unknown as Parameters<NonNullable<typeof walletClient>["signTypedData"]>[0];

          const signature = await walletClient.signTypedData(signParams);

          const result = await instance.userDecrypt(
            [{ handle, contractAddress: tokenAddress }],
            keypair.privateKey,
            keypair.publicKey,
            String(signature).replace("0x", ""),
            contractAddresses,
            address,
            startTimeStamp,
            durationDays
          );

          const value = toDisplayString(result[handle as string]);
          if (value) {
            setBalances((b) => ({ ...b, [tokenAddress]: value }));
            addNotice({ id: `${tokenAddress}-ok`, type: "success", title: "Decryption successful" });
          } else {
            addNotice({ id: `${tokenAddress}-empty`, type: "info", title: "Decrypted, but returned empty value" });
          }
        } catch (e) {
          addNotice({ id: `${tokenAddress}-err`, type: "error", title: "Query failed", message: (e as Error)?.message || String(e) });
        } finally {
          setPending((p) => ({ ...p, [tokenAddress]: false }));
        }
      })();
    };
  }, [address, pending, walletClient]);

  const onSend = useMemo(() => {
    return (tokenAddress: string) => {
      if (!address) return;
      if (sendPending[tokenAddress]) return;
      const to = (toMap[tokenAddress] || "").trim();
      const amountStr = (amountMap[tokenAddress] || "").trim();
      if (!to || !to.startsWith("0x") || to.length !== 42) {
        addNotice({ id: `${tokenAddress}-badto`, type: "error", title: "Invalid recipient address" });
        return;
      }
      let amount: bigint;
      try {
        amount = BigInt(amountStr);
      } catch {
        addNotice({ id: `${tokenAddress}-badamt`, type: "error", title: "Invalid amount" });
        return;
      }
      if (amount <= BigInt(0)) {
        addNotice({ id: `${tokenAddress}-nonpos`, type: "error", title: "Amount must be greater than 0" });
        return;
      }
      setSendPending((p) => ({ ...p, [tokenAddress]: true }));
      (async () => {
        try {
          const inst = (await getZamaInstance()) as unknown as Record<string, unknown>;
          const instance = inst as unknown as {
            createEncryptedInput: (contractAddress: string) => {
              add64: (v: string | number | bigint) => `0x${string}`;
              encrypt: (params: { address: string; signTypedData: (args: Parameters<NonNullable<typeof walletClient>["signTypedData"]>[0]) => Promise<string> }) => Promise<{ handles: `0x${string}`[]; inputProof: `0x${string}` }>;
            };
          };

          if (!walletClient) {
            addNotice({ id: `${tokenAddress}-nw2`, type: "error", title: "Wallet not connected or does not support signing" });
            return;
          }

          const input = instance.createEncryptedInput(tokenAddress);
          const encryptedAmount = input.add64(amount.toString());
          const enc = await input.encrypt({
            address,
            signTypedData: (args) => walletClient.signTypedData(args),
          });

          await writeContract(wagmiConfig, {
            address: tokenAddress as `0x${string}`,
            abi: ConfidentialMintableTokenABI,
            functionName: "confidentialTransfer",
            args: [to as `0x${string}`, encryptedAmount, enc.inputProof],
          });

          addNotice({ id: `${tokenAddress}-sent`, type: "success", title: "Transfer submitted" });
        } catch (e) {
          addNotice({ id: `${tokenAddress}-senderr`, type: "error", title: "Transfer failed", message: (e as Error)?.message || String(e) });
        } finally {
          setSendPending((p) => ({ ...p, [tokenAddress]: false }));
        }
      })();
    };
  }, [address, walletClient, toMap, amountMap, sendPending]);

  if (!mounted) {
    return (
      <div className="w-full p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-sky-500 animate-spin" />
            <p className="text-sm text-foreground/60">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground mb-4 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Home
        </Link>
        {!address ? (
          <div className="text-center py-12">
            <p className="text-sm text-foreground/60">Please connect wallet to view your tokens</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-sky-500 animate-spin" />
            <p className="text-sm text-foreground/60">Loading...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-foreground/60">No tokens to display</p>
            <p className="mt-1 text-xs text-foreground/50">Tokens you create or hold will appear here</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground/80 mb-2">Select Token</label>
              <select
                value={selectedTokenAddress}
                onChange={(e) => setSelectedTokenAddress(e.target.value)}
                className="w-full rounded-lg border border-foreground/15 bg-foreground/[0.03] px-4 py-3 text-sm outline-none focus:border-sky-400 transition-colors"
              >
                {tokens.map((token) => (
                  <option key={token.token} value={token.token}>
                    {token.name} ({token.symbol})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const token = tokens.find((t) => t.token === selectedTokenAddress);
              if (!token) return null;

              return (
                <div className="rounded-xl border border-white/10 bg-foreground/[0.03] p-5">
                  <div className="flex items-start gap-4 mb-4">
                    {token.iconCid ? (
                      <Image
                        src={`https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${token.iconCid}`}
                        alt={token.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-xl">
                        {token.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold mb-0.5">{token.name}</h2>
                      <p className="text-sm text-foreground/60 mb-2">{token.symbol}</p>
                      {token.description && (
                        <p className="text-xs text-foreground/70 line-clamp-2">{token.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-0.5">Max Supply</div>
                      <div className="text-sm font-semibold">{token.maxSupply.toString()}</div>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-0.5">Public Allocation</div>
                      <div className="text-sm font-semibold">{token.publicAllocation.toString()}</div>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-0.5">Creator Reserve</div>
                      <div className="text-sm font-semibold">{token.creatorReserveBps / 100}%</div>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-0.5">Public Mint</div>
                      <div className="text-sm font-semibold">{token.publicMintBps / 100}%</div>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-0.5">Per Mint</div>
                      <div className="text-sm font-semibold">{token.perMintAmount.toString()}</div>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-0.5">Wallet Limit</div>
                      <div className="text-sm font-semibold">{token.perWalletMintLimit}</div>
                    </div>
                    <div className="col-span-2 rounded-lg border border-foreground/10 bg-foreground/5 p-3">
                      <div className="text-xs text-foreground/50 mb-1">Contract Address</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(token.token);
                          const notice: Notice = {
                            id: Date.now().toString(),
                            type: "success",
                            title: "Contract address copied",
                          };
                          setNotices((prev) => [...prev, notice]);
                          setTimeout(() => {
                            setNotices((prev) => prev.filter((n) => n.id !== notice.id));
                          }, 2000);
                        }}
                        className="flex items-center gap-2 text-xs font-mono hover:text-sky-500 transition-colors group"
                        title={token.token}
                      >
                        <span>{token.token.slice(0, 10)}...{token.token.slice(-8)}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-foreground/80">Balance</div>
                        <button
                          onClick={() => onQueryBalance(token.token)}
                          disabled={pending[token.token]}
                          className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pending[token.token] ? "Querying..." : "Query"}
                        </button>
                      </div>
                      <div className="rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm text-foreground/80">
                        {balances[token.token] ?? "Not queried"}
                      </div>
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/token/${token.token}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium border border-foreground/15 bg-foreground/5 text-foreground transition-colors hover:bg-foreground/10"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-foreground/10 pt-4">
                    <h3 className="text-xs font-medium text-foreground/80 mb-3">Send Tokens</h3>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        value={toMap[token.token] ?? ""}
                        onChange={(e) => setToMap((m) => ({ ...m, [token.token]: e.target.value }))}
                        placeholder="Recipient Address 0x..."
                        className="md:col-span-2 w-full rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-xs outline-none focus:border-sky-400 transition-colors"
                      />
                      <input
                        value={amountMap[token.token] ?? ""}
                        onChange={(e) => setAmountMap((m) => ({ ...m, [token.token]: e.target.value }))}
                        placeholder="Amount"
                        inputMode="numeric"
                        className="w-full rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-xs outline-none focus:border-sky-400 transition-colors"
                      />
                      <button
                        onClick={() => onSend(token.token)}
                        disabled={sendPending[token.token]}
                        className="md:col-span-3 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendPending[token.token] ? "Sending..." : "Send Tokens"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto rounded-md border p-3 shadow-md ${
              n.type === "success" ? "border-green-200 bg-green-50 text-green-800" : n.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{n.title}</div>
              <button
                onClick={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))}
                className="text-xs opacity-60 hover:opacity-100"
              >
                Close
              </button>
            </div>
            {n.message && <div className="mt-1 text-xs opacity-80 break-words">{n.message}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}


