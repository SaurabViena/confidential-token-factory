import { FHEVM_CONFIG } from "@/config/fhevm";

type SepoliaConfigType = Record<string, unknown>;

interface EIP1193RequestArgs {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

interface EIP1193Provider {
  request: (args: EIP1193RequestArgs) => Promise<unknown>;
  providers?: EIP1193Provider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isOkxWallet?: boolean; // OKX
  isOKExWallet?: boolean; // legacy flag
}

interface ZamaRelayerSDKShape {
  initSDK: () => Promise<void>;
  createInstance: (config: SepoliaConfigType) => Promise<unknown>;
  SepoliaConfig: SepoliaConfigType;
  // v0.9 additions
  publicDecrypt?: (pairs: { handle: string; contractAddress: string }[], contractAddress: string, userAddress: string) => Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    ZamaRelayerSDK?: ZamaRelayerSDKShape;
    fhevm?: ZamaRelayerSDKShape;
  }
}

let instancePromise: Promise<unknown> | null = null;

export function initZamaRelayer(): Promise<unknown> {
  if (instancePromise) return instancePromise;
  instancePromise = new Promise(async (resolve, reject) => {
    try {
      const isDev = process.env.NODE_ENV !== "production";
      if (isDev) {
        console.groupCollapsed("Zama FHE Init (v0.9)");
        console.info("SDK Version:", FHEVM_CONFIG.RELAYER_SDK_VERSION);
        console.info("Gateway Address:", FHEVM_CONFIG.GATEWAY_ADDRESS);
        console.info("Global (fhevm) present:", Boolean(window.fhevm));
        console.info("Global (ZamaRelayerSDK) present:", Boolean(window.ZamaRelayerSDK));
        console.info("window.ethereum:", Boolean(window.ethereum));
      }
      // Wait for global UMD/ESM bridge injection (see layout.tsx)
      const waitStart = Date.now();
      while (!window.fhevm && !window.ZamaRelayerSDK && Date.now() - waitStart <= 10000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const sdk = window.fhevm ?? window.ZamaRelayerSDK;
      if (!sdk) return reject(new Error("Zama Relayer SDK not loaded"));
      const { initSDK, createInstance, SepoliaConfig } = sdk;
      if (typeof initSDK !== "function" || typeof createInstance !== "function" || !SepoliaConfig) {
        throw new Error("Zama Relayer SDK structure error: missing required exports");
      }
      await initSDK();
      if (isDev) {
        console.info("initSDK(): WASM loaded");
        console.info("crossOriginIsolated:", (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true);
      }
      const rpcUrl =
        (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL && process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL.trim()) ||
        FHEVM_CONFIG.DEFAULT_RPC_URL;
      if (isDev) {
        console.info("Using RPC URL:", rpcUrl);
      }
      const win = window as unknown as { ethereum?: EIP1193Provider };
      const aggregated = win.ethereum;
      if (aggregated && typeof aggregated.request === "function") {
        try {
          const chainIdHex = (await aggregated.request({ method: "eth_chainId" })) as string | number;
          const chainId = typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : Number(chainIdHex);
          if (isDev) {
            console.info("Wallet detected chainId:", chainId);
          }
          if (chainId !== FHEVM_CONFIG.CHAIN_ID) {
            if (isDev) console.warn("Wallet not on Sepolia (will use configured RPC)");
          }
        } catch (e) {
          if (isDev) console.warn("Wallet detection failed (will use configured RPC):", e);
        }
      }
      const config: SepoliaConfigType = { ...SepoliaConfig, network: rpcUrl };
      if (isDev) {
        console.info("createInstance() starting, config:", config);
      }
      const timeoutMs = FHEVM_CONFIG.CREATE_INSTANCE_TIMEOUT_MS;
      const inst = await Promise.race([
        createInstance(config),
        new Promise((_, rejectRace) =>
          setTimeout(() => rejectRace(new Error(`createInstance timeout (${timeoutMs}ms)`)), timeoutMs)
        ),
      ]);
      if (isDev) {
        console.info("createInstance() completed, instance:", inst ? "ok" : "null");
        console.groupEnd();
      }
      resolve(inst);
    } catch (e) {
      console.error("Zama FHE Init failed:", e);
      reject(e);
    }
  });
  return instancePromise;
}

export async function getZamaInstance(): Promise<unknown> {
  return initZamaRelayer();
}

export function getGatewayAddress(): string {
  return FHEVM_CONFIG.GATEWAY_ADDRESS;
}


