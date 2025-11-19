"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReadContract, useReadContracts } from "wagmi";
import { TokenFactoryABI, ConfidentialMintableTokenABI } from "@/config/abi";

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}` | undefined;

type TokenInfo = {
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

function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isBigInt(v: unknown): v is bigint {
  return typeof v === "bigint";
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function parseTokenInfo(u: unknown): TokenInfo | null {
  if (!u || typeof u !== "object") return null;
  const v = u as Record<string, unknown>;
  if (!isString(v.token) || !isString(v.creator)) return null;
  if (!isString(v.name) || !isString(v.symbol)) return null;
  if (!isString(v.description)) return null;
  if (!isString(v.iconCid)) return null;
  const maxSupply = isBigInt(v.maxSupply) ? v.maxSupply : (() => { try { return BigInt(v.maxSupply as string); } catch { return null; } })();
  const perMintAmount = isBigInt(v.perMintAmount) ? v.perMintAmount : (() => { try { return BigInt(v.perMintAmount as string); } catch { return null; } })();
  const publicAllocation = isBigInt(v.publicAllocation) ? v.publicAllocation : (() => { try { return BigInt(v.publicAllocation as string); } catch { return null; } })();
  if (maxSupply === null || perMintAmount === null || publicAllocation === null) return null;
  if (!isNumber(v.creatorReserveBps) || !isNumber(v.publicMintBps) || !isNumber(v.perWalletMintLimit)) return null;
  return {
    token: v.token,
    creator: v.creator,
    name: v.name,
    symbol: v.symbol,
    description: v.description,
    iconCid: v.iconCid,
    maxSupply,
    creatorReserveBps: v.creatorReserveBps,
    publicMintBps: v.publicMintBps,
    perMintAmount,
    perWalletMintLimit: v.perWalletMintLimit,
    publicAllocation,
  } as TokenInfo;
}

function SkeletonItem() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-foreground/[0.03] px-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-foreground/10 animate-pulse" />
        <div className="space-y-1 min-w-0">
          <div className="h-3 w-28 bg-foreground/10 rounded animate-pulse" />
          <div className="h-3 w-16 bg-foreground/10 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-6 w-14 rounded-full bg-foreground/10 animate-pulse" />
    </div>
  );
}

function TokenRow({ t, progressPct }: { t: TokenInfo; progressPct?: number }) {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "";
  const iconUrl = t.iconCid && gateway ? `https://${gateway}/ipfs/${t.iconCid}` : "";
  return (
    <Link href={`/token/${t.token}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-foreground/[0.03] px-3 py-3 hover:bg-foreground/[0.05] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full overflow-hidden bg-foreground/10">
          {iconUrl ? (
            <Image src={iconUrl} alt="icon" width={36} height={36} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
              {t.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{t.name}</div>
          <div className="text-xs text-foreground/60 truncate">{t.symbol}</div>
        </div>
      </div>
      <div className="shrink-0 text-xs rounded-full px-2 py-1 border border-white/10 text-foreground/80 relative">
        {typeof progressPct === "number" ? `${progressPct.toFixed(2)}%` : "--"}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: "1px solid transparent",
            background: `conic-gradient(#a3e635 0% ${Math.max(0, Math.min(100, typeof progressPct === "number" ? progressPct : 0))}%, transparent ${Math.max(0, Math.min(100, typeof progressPct === "number" ? progressPct : 0))}% 100%) border-box`,
            WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            borderRadius: 9999,
            transition: "background 200ms ease",
          }}
        />
      </div>
    </Link>
  );
}

function Section({ title, items, loading }: { title: string; items?: TokenInfo[]; loading?: boolean }) {
  const count = items?.length ?? 0;
  const placeholders = loading ? 6 : Math.max(0, 6 - count);
  const displayItems = items?.slice(0, 10) || [];
  return (
    <section className="rounded-2xl border border-white/10 bg-foreground/[0.02] p-4">
      <h3 className="text-sm font-medium mb-3 tracking-tight">{title}</h3>
      <div className="max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        <div className="space-y-3 pr-1">
          {!loading && displayItems.length > 0 && displayItems.map((t, idx) => <TokenRow key={String(idx) + t.token} t={t} progressPct={(t as unknown as TokenInfo & { progressPct?: number }).progressPct} />)}
          {Array.from({ length: placeholders }).map((_, idx) => <SkeletonItem key={`ph-${idx}`} />)}
        </div>
      </div>
    </section>
  );
}

function TypewriterText({ text, delay = 50 }: { text: string; delay?: number }) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return <>{displayText}</>;
}

export default function Home() {
  const countRes = useReadContract({
    abi: TokenFactoryABI as unknown as import("viem").Abi,
    address: FACTORY_ADDRESS,
    functionName: "getTokensCount",
    query: {
      enabled: Boolean(FACTORY_ADDRESS),
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    },
  });

  const count = Number(countRes.data || 0);

  const newestIdx = useMemo(() => {
    if (!count) return [] as number[];
    const start = Math.max(0, count - 6);
    const arr: number[] = [];
    for (let i = count - 1; i >= start; i--) arr.push(i);
    return arr;
  }, [count]);

  const readNewest = useReadContracts({
    contracts: newestIdx.map((i) => ({
      abi: TokenFactoryABI as unknown as import("viem").Abi,
      address: FACTORY_ADDRESS!,
      functionName: "getTokenInfo",
      args: [BigInt(i)],
    })),
    query: {
      enabled: Boolean(FACTORY_ADDRESS) && newestIdx.length > 0,
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    },
  });

  const allItems: TokenInfo[] = useMemo(() => {
    const results = (readNewest.data || []) as Array<{ result?: unknown }>;
    return results.map((r) => parseTokenInfo(r.result)).filter((x): x is TokenInfo => Boolean(x));
  }, [readNewest.data]);

  const newestItems = allItems;
  const tokenAddrs = newestItems.map((t) => t.token as `0x${string}`);

  const mintedReads = useReadContracts({
    contracts: tokenAddrs.map((addr) => ({
      abi: ConfidentialMintableTokenABI as unknown as import("viem").Abi,
      address: addr,
      functionName: "totalMinted" as const,
    })),
    query: {
      enabled: tokenAddrs.length > 0,
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    },
  });

  const progressMap = useMemo(() => {
    const res = new Map<string, number>();
    const data = mintedReads.data as Array<{ result?: unknown } | undefined> | undefined;
    if (!data) return res;
    for (let i = 0; i < tokenAddrs.length; i++) {
      const minted = data[i]?.result as unknown;
      if (minted !== undefined) {
        const max = newestItems[i]?.maxSupply;
        if (typeof max === "bigint" && max > BigInt(0)) {
          const pct = Number(minted as bigint) / Number(max) * 100;
          res.set(tokenAddrs[i], Math.max(0, Math.min(100, pct)));
        }
      }
    }
    return res;
  }, [mintedReads.data, tokenAddrs, newestItems]);

  const newestWithProgress = useMemo(() => {
    return newestItems.map((t) => ({ ...t, progressPct: progressMap.get(t.token) }));
  }, [newestItems, progressMap]);
  const soaringItems = useMemo(() => {
    const list = [...newestWithProgress];
    list.sort((a, b) => (b.progressPct || 0) - (a.progressPct || 0));
    return list;
  }, [newestWithProgress]);

  return (
    <div className="w-full p-6 md:p-8">
      {/* Top slogan and buttons */}
      <div className="flex flex-col items-center pb-4 md:pb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-emerald-400 animate-pulse">
            <path d="M10 2L12.5 7.5L18 8.5L14 13L15 18.5L10 15.5L5 18.5L6 13L2 8.5L7.5 7.5L10 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span className="text-lg md:text-xl font-semibold bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tight animate-gradient bg-[length:200%_auto] min-h-[1.75rem] inline-block">
            <TypewriterText text="Create Confidential Tokens Effortlessly" delay={60} />
          </span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-cyan-400 animate-pulse">
            <path d="M10 2L12.5 7.5L18 8.5L14 13L15 18.5L10 15.5L5 18.5L6 13L2 8.5L7.5 7.5L10 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-blue-400 animate-bounce-slow">
            <path d="M10 2C10 2 4 5 4 10C4 13 4 18 10 18C16 18 16 13 16 10C16 5 10 2 10 2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="10" cy="10" r="2" fill="currentColor" fillOpacity="0.4"/>
          </svg>
          <span className="text-base md:text-lg font-medium bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent tracking-tight animate-gradient bg-[length:200%_auto] min-h-[1.5rem] inline-block">
            <TypewriterText text="Private Transactions • Secure & Reliable" delay={70} />
          </span>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-violet-400 animate-bounce-slow">
            <path d="M10 2C10 2 4 5 4 10C4 13 4 18 10 18C16 18 16 13 16 10C16 5 10 2 10 2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="10" cy="10" r="2" fill="currentColor" fillOpacity="0.4"/>
          </svg>
        </div>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/create"
            className="h-10 md:h-11 px-5 md:px-6 rounded-full bg-[#FFDD00] text-black text-sm md:text-base font-medium hover:bg-[#FFE44D] transition-colors flex items-center justify-center"
          >
            Create Token
          </Link>
          <Link
            href="/dashboard"
            className="h-10 md:h-11 px-5 md:px-6 rounded-full bg-white text-black text-sm md:text-base font-medium border border-black/10 dark:border-white/15 hover:bg-white/90 transition-colors flex items-center justify-center"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Three-column card area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Section title="Newest" items={newestWithProgress} loading={countRes.isLoading || readNewest.isLoading || mintedReads.isLoading} />
        <Section title="Soaring" items={soaringItems} loading={countRes.isLoading || readNewest.isLoading || mintedReads.isLoading} />
        <Section title="Launched" loading />
      </div>
    </div>
  );
}
