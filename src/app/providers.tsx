"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { createConfig, WagmiProvider, http } from "wagmi";
import { 
  RainbowKitProvider, 
  connectorsForWallets, 
  lightTheme 
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  injectedWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sepolia } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";
import { initZamaRelayer } from "@/lib/zama";
import { ZamaStatusContext } from "@/lib/zama-context";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const wcProjectId = walletConnectProjectId && walletConnectProjectId.trim().length > 0 ? walletConnectProjectId : "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        walletConnectWallet,
        injectedWallet,
        safeWallet,
      ],
    },
  ],
  {
    appName: "zama-token-factory",
    projectId: wcProjectId || "placeholder-project-id",
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  batch: { multicall: true },
  transports: {
    [sepolia.id]: (() => {
      const rpc = (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "").trim();
      return rpc ? http(rpc) : http();
    })(),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only request once after page load
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
    },
  },
});

export default function Providers({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    initZamaRelayer().then(() => setReady(true)).catch((e) => setError((e as Error).message || String(e)));
  }, []);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ZamaStatusContext.Provider value={{ ready, error }}>
          <RainbowKitProvider theme={lightTheme({ accentColor: "#0ea5e9" })} modalSize="compact">
            {children}
            {error && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-2xl">
                  <div className="mb-4 flex items-center gap-3">
                    <svg className="h-6 w-6 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">Initialization Failed</h3>
                  </div>
                  <p className="mb-6 text-sm text-gray-600">
                    FHE encryption environment initialization failed. Please refresh the page and try again. If the problem persists, please try again later or contact technical support.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            )}
          </RainbowKitProvider>
        </ZamaStatusContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}


