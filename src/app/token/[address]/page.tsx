"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { ConfidentialMintableTokenABI, TokenFactoryABI } from "@/config/abi";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
      <span className="text-sm text-foreground/70">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}` | undefined;

export default function TokenDetailPage() {
  const params = useParams<{ address: string }>();
  const address = (params?.address || "") as `0x${string}`;
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1500);
  }

  const cName = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "name" });
  const cSymbol = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "symbol" });
  const cDesc = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "description" });
  const cIcon = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "iconCid" });
  const cMax = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "maxSupply" });
  const cPerMint = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "perMintAmount" });
  const cPerWallet = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "perWalletMintLimit" });
  const cPublicAlloc = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "publicAllocation" });
  const cCreatorBps = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "creatorReserveBps" });
  const cPublicBps = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "publicMintBps" });
  const cIsPublicTotal = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "isTotalSupplyPublic" });
  const cTotalMinted = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "totalMinted" });
  const cCreator = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "creator" });
  const cPublicEnabled = useReadContract({ abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi, address, functionName: "publicMintEnabled" });

  const countRes = useReadContract({
    abi: TokenFactoryABI as unknown as import("viem").Abi,
    address: FACTORY_ADDRESS,
    functionName: "getTokensCount",
    query: { enabled: Boolean(FACTORY_ADDRESS) },
  });
  const count = Number(countRes.data || 0);
  const idxArr = useMemo(() => (count ? Array.from({ length: count }, (_, i) => i) : []), [count]);
  const infosRes = useReadContracts({
    contracts: idxArr.map((i) => ({
      abi: TokenFactoryABI as unknown as import("viem").Abi,
      address: FACTORY_ADDRESS!,
      functionName: "getTokenInfo" as const,
      args: [BigInt(i)],
    })),
    query: { enabled: Boolean(FACTORY_ADDRESS) && idxArr.length > 0 },
  });
  const originalCreator = useMemo(() => {
    const list = (infosRes.data || []) as Array<{ result?: unknown }>;
    for (const r of list) {
      const v = r?.result as { token?: string; creator?: string } | undefined;
      if (v && typeof v.token === "string" && v.token.toLowerCase() === address.toLowerCase()) {
        return typeof v.creator === "string" ? (v.creator as `0x${string}`) : undefined;
      }
    }
    return undefined;
  }, [infosRes.data, address]);

  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "";

  const progressPct = useMemo(() => {
    const minted = cTotalMinted.data as bigint | undefined;
    const max = cMax.data as bigint | undefined;
    if (typeof minted === "bigint" && typeof max === "bigint" && max > BigInt(0)) {
      return Math.max(0, Math.min(100, Number(minted) / Number(max) * 100));
    }
    return undefined;
  }, [cTotalMinted.data, cMax.data]);

  const iconUrl = useMemo(() => {
    const cid = (cIcon.data as string) || "";
    return cid && gateway ? `https://${gateway}/ipfs/${cid}` : "";
  }, [cIcon.data, gateway]);

  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const displayCreator = useMemo(() => {
    const onChain = cCreator.data as `0x${string}` | undefined;
    if (onChain && onChain !== zeroAddr) return onChain;
    if (originalCreator) return originalCreator;
    return undefined;
  }, [cCreator.data, originalCreator]);
  const isRenounced = (cCreator.data as string | undefined)?.toLowerCase() === zeroAddr;

  const isSoldOut = typeof progressPct === "number" && progressPct >= 100;

  async function onMint() {
    if (!isConnected) {
      showToast("Please connect wallet first");
      return;
    }
    try {
      const MinimalPublicMintABI = [
        { name: "publicMint", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
      ] as unknown as import("viem").Abi;
      const hash = await writeContractAsync({
        abi: MinimalPublicMintABI,
        address,
        functionName: "publicMint",
      });
      showToast("Transaction sent: " + String(hash).slice(0, 10) + "…");
      cTotalMinted.refetch?.();
    } catch (err) {
      const msg = (err as Error)?.message || "Submission failed";
      showToast(msg);
    }
  }

  return (
    <div className="w-full p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {toast ? (
          <div className="toast-portal"><div className="rounded-md bg-foreground text-background px-3 py-2 text-sm shadow">{toast}</div></div>
        ) : null}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground mb-4 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back to Home
        </Link>

        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-foreground/10">
              {iconUrl ? <Image src={iconUrl} alt="icon" width={48} height={48} className="w-full h-full object-cover" /> : 
              <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-semibold text-lg">
                {((cName.data as string) || "").charAt(0)}
              </div>}
            </div>
            <div>
              <div className="text-lg font-semibold">{(cName.data as string) || "--"}</div>
              <div className="text-sm text-foreground/60">{(cSymbol.data as string) || "--"}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-foreground/60 mb-1">Contract Address</div>
            <button
            onClick={() => {
              navigator.clipboard.writeText(address);
              showToast("Contract address copied");
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/[0.05] hover:bg-foreground/[0.08] transition-colors group"
            title={address}
          >
            <span className="text-sm font-mono text-foreground/80">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60 group-hover:text-foreground/80 transition-colors">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-foreground/60">Mint Progress</div>
            <div className="text-base font-semibold text-lime-400 transition-all duration-300">{typeof progressPct === "number" ? `${progressPct.toFixed(2)}%` : "--"}</div>
          </div>
          <div className="relative h-3 rounded-full bg-foreground/10 overflow-hidden shadow-inner">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-lime-400 via-emerald-500 to-lime-400 transition-all duration-700 ease-out animate-shimmer"
              style={{ 
                width: `${typeof progressPct === "number" ? progressPct : 0}%`,
                backgroundSize: "200% 100%"
              }} 
            />
            {typeof progressPct === "number" && progressPct > 0 && (
              <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-slide" />
            )}
          </div>
        </div>

        {/* Information container: About at the first position */}
        <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-foreground/[0.02]">
          <div className="pb-2 mb-2 border-b border-white/10">
            <div className="text-sm font-medium mb-1">About</div>
            <div className="text-sm text-foreground/80 whitespace-pre-wrap">{(cDesc.data as string) || "--"}</div>
          </div>
          <StatRow label="Total Supply" value={String(cMax.data ?? "--").toLocaleString?.() || String(cMax.data ?? "--")} />
          <StatRow label="Mintable amount" value={String(cPublicAlloc.data ?? "--")} />
          <StatRow label="Mint Limit per Tx" value={String(cPerMint.data ?? "--")} />
          <StatRow label="Per Wallet Limit" value={
            typeof cPerWallet.data === "number" 
              ? (cPerWallet.data === 0 ? "Unlimited" : String(cPerWallet.data))
              : "--"
          } />
          <StatRow label="Creator Reserve" value={typeof cCreatorBps.data === "number" ? `${(cCreatorBps.data/100).toFixed(2)}%` : "--"} />
          <StatRow label="Public Mint" value={typeof cPublicBps.data === "number" ? `${(cPublicBps.data/100).toFixed(2)}%` : "--"} />
          <StatRow label="Total Visible" value={(cIsPublicTotal.data as boolean | undefined) ? "Yes" : "No"} />
          <StatRow label="Governance Renounced" value={<span className={`font-medium ${isRenounced ? "text-emerald-400" : "text-red-400"}`}>{isRenounced ? "Yes" : "No"}</span>} />
          <StatRow label="Creator Address" value={
            displayCreator
              ? <a className="underline underline-offset-2" href={`https://sepolia.etherscan.io/address/${displayCreator}`} target="_blank" rel="noreferrer">{displayCreator}</a>
              : (cCreator.data === zeroAddr ? "Renounced" : "--")
          } />
        </div>

        {/* Enlarge button and center */}
        <div className="pt-2">
          <button disabled={isPending || (cPublicEnabled.data === false) || isSoldOut} onClick={onMint} className="h-12 md:h-14 w-full max-w-md mx-auto block px-10 rounded-full bg-[#FFDD00] text-black text-base md:text-lg font-medium hover:bg-[#FFE44D] transition-colors disabled:opacity-60">
            {isPending ? "Submitting..." : "Mint"}
          </button>
          {cPublicEnabled.data === false ? (
            <span className="mt-2 block text-center text-xs text-foreground/60">Public mint not enabled</span>
          ) : isSoldOut ? (
            <span className="mt-2 block text-center text-xs text-foreground/60">Sold out</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}


