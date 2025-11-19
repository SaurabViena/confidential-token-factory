// FHEVM 0.9 Configuration for Sepolia Network

export const FHEVM_CONFIG = {
  // Gateway contract address for Sepolia (v0.9)
  GATEWAY_ADDRESS: "0xC8c57e4C73c71f72cA0a7e043E5D2D144F98ef13" as const,
  
  // Relayer SDK version
  RELAYER_SDK_VERSION: "0.3.0-5" as const,
  
  // Network configuration
  CHAIN_ID: 11155111, // Sepolia
  NETWORK_NAME: "Sepolia",
  
  // Default RPC URL (fallback)
  DEFAULT_RPC_URL: "https://ethereum-sepolia.publicnode.com",
  
  // Timeout settings
  CREATE_INSTANCE_TIMEOUT_MS: 30000,
  DECRYPT_TIMEOUT_MS: 30000,
} as const;

export type FhevmConfig = typeof FHEVM_CONFIG;
