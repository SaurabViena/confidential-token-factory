# Confidential Token Factory

A zero-barrier decentralized application (dApp) that enables anyone to create and manage confidential tokens using Zama's FHEVM technology.

## Overview

Confidential Token Factory is a contract factory and frontend interface that simplifies the creation of privacy-preserving ERC-7984 compliant confidential tokens. Built on Zama's Fully Homomorphic Encryption Virtual Machine (FHEVM), it allows users to deploy tokens with encrypted balances while maintaining full functionality of traditional fungible tokens.

## Key Features

### For Token Creators
- **Zero-Code Deployment**: Create confidential tokens through an intuitive web interface
- **Flexible Tokenomics**: Configure supply, creator reserves, public mint allocation, and per-wallet limits
- **Governance Control**: Manage mint schedules, whitelist requirements, metadata, and pause/blocklist functions
- **Optional Renouncement**: Choose to renounce governance at creation or later
- **IPFS Integration**: Upload token icons directly to IPFS via Pinata

### For Token Users
- **Private Balances**: All token balances are encrypted using FHE technology
- **Secure Transfers**: Send tokens with confidential amounts
- **User Decryption**: Query and decrypt your own balance using EIP-712 signing
- **Dashboard Management**: View all tokens you own, created, or minted in one place

## Technology Stack

### Smart Contracts
- **Solidity 0.8.27**: Latest Solidity with optimized security
- **Zama FHEVM**: Fully Homomorphic Encryption for confidential computations
- **OpenZeppelin Confidential (ERC-7984)**: Standard for confidential fungible tokens
- **OpenZeppelin Access Control**: Role-based permission management

### Frontend
- **Next.js 15**: React framework with App Router and SSR
- **TypeScript**: Type-safe development
- **Wagmi v2**: React hooks for Ethereum
- **RainbowKit**: Wallet connection UI
- **Tailwind CSS 4**: Modern utility-first styling
- **Zama Relayer SDK**: Client-side FHE encryption/decryption

## Smart Contract Architecture

### ConfidentialMintableToken.sol
Core confidential token contract with the following features:

**Configuration**
- Decimals: 0 (integer units for simplified frontend interaction)
- Max supply, creator reserve percentage, public mint percentage
- Per-mint amount and per-wallet mint limit
- Optional public total supply visibility

**Governance Functions** (Creator only)
- Pause/unpause operations
- Blocklist/unblocklist addresses
- Update public mint settings (enable/disable, time window, whitelist, limits)
- Update metadata (description, icon CID)
- Freeze metadata permanently
- Two-step creator transfer or renouncement

**Minting Functions**
- Public mint with fixed amount per transaction
- Optional whitelist verification via Merkle proof
- Creator mint with custom amounts
- Creator burn capability

**View Functions**
- `getConfig()`: Retrieve all token configuration
- `totalMinted()`: Total minted amount (permission-gated)
- `publicMinted()`: Public minted amount (permission-gated)
- `isSoldOut()`: Check if public allocation is exhausted
- `confidentialBalanceOf()`: Returns encrypted balance handle (inherited from ERC-7984)

**Asset Rescue**
- Emergency ETH and ERC20 token withdrawal (creator only)

### TokenFactory.sol
Factory contract for deploying confidential tokens:

**Functions**
- `createToken()`: Deploy new confidential token with specified parameters
- `getTokensCount()`: Get total number of deployed tokens
- `getTokenInfo(uint256 idx)`: Retrieve token metadata by index

**Stored Information**
- Token address, creator, name, symbol
- Description, icon CID
- Supply and allocation parameters

## Frontend Features

### Home Page
- **Token Discovery**: Browse newest and trending tokens
- **Real-time Progress**: Visual mint progress indicators
- **Quick Actions**: Navigate to token creation or dashboard

### Create Token Page
Comprehensive form for deploying new tokens:
- Basic metadata (name, symbol, description)
- Icon upload to IPFS
- Supply configuration (max supply, creator reserve, public allocation)
- Mint parameters (amount per mint, wallet limit)
- Privacy settings (public total supply visibility)
- Governance options (renounce on creation)

### Dashboard Page
Personalized token management:
- View all tokens you own (created, minted, or hold balance)
- Query encrypted balances with user decryption
- Send tokens to other addresses
- Copy contract addresses
- Navigate to token detail pages

### Token Detail Page
Comprehensive token information:
- Token metadata and icon
- Contract address with explorer link
- Governance status (renounced or active)
- Creator address
- Supply and allocation details
- Per-wallet mint limit
- Public mint status
- Visual mint progress with animations
- Mint function (if public mint enabled)

## Installation & Setup

### Prerequisites
- Node.js 20+ and npm/yarn/pnpm
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH

### Environment Variables
Create a `.env.local` file in the project root:

```env
# Factory contract address (deploy TokenFactory.sol first)
NEXT_PUBLIC_FACTORY_ADDRESS=0x...

# Sepolia RPC URL (optional, uses public RPC if not set)
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Pinata API for IPFS uploads
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_token
NEXT_PUBLIC_PINATA_GATEWAY=your_gateway.mypinata.cloud

# WalletConnect Project ID (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at `http://localhost:3000`.

## Contract Deployment

1. **Deploy TokenFactory**
   ```bash
   # Deploy to Sepolia (or your chosen network)
   # Use your preferred deployment tool (Hardhat, Foundry, Remix)
   ```

2. **Update .env.local**
   ```env
   NEXT_PUBLIC_FACTORY_ADDRESS=0xYourDeployedFactoryAddress
   ```

3. **Generate ABI files**
   - Export ABIs from your compiled contracts
   - Update files in `src/config/abi/`

## Usage Guide

### Creating a Token

1. Connect your wallet (MetaMask recommended)
2. Navigate to "Create Token" page
3. Fill in token details:
   - **Name & Symbol**: Token identification
   - **Description**: Optional token description
   - **Icon**: Upload image (stored on IPFS)
   - **Max Supply**: Total token cap
   - **Creator Reserve**: Percentage minted to creator immediately (basis points)
   - **Public Mint Allocation**: Percentage available for public minting (basis points)
   - **Per Mint Amount**: Fixed amount per public mint transaction
   - **Per Wallet Limit**: Max mints per address (0 = unlimited)
4. Configure privacy and governance options
5. Submit transaction and wait for confirmation
6. Token will appear on your Dashboard

### Minting Tokens (Public)

1. Navigate to a token's detail page
2. Click "Mint" button (if public mint is enabled)
3. Confirm transaction in your wallet
4. Encrypted tokens will be added to your balance

### Querying Your Balance

1. Go to Dashboard page
2. Find the token you want to query
3. Click "Query Balance" button
4. Sign EIP-712 message in your wallet (for decryption authorization)
5. Decrypted balance will display in the balance box

### Sending Tokens

1. Go to Dashboard page
2. Enter recipient address (0x...)
3. Enter amount to send
4. Click "Send" button
5. Confirm transaction in wallet
6. Encrypted transfer will be executed

## Security Considerations

### Smart Contract Security
- Audited OpenZeppelin contracts as base
- Reentrancy protection via state updates before external calls
- Access control for privileged functions
- Emergency pause functionality
- Blocklist capability for compliance

### Frontend Security
- Client-side encryption before sending sensitive data
- EIP-712 typed data signing for user authorization
- No private keys or sensitive data stored in browser
- All contract interactions via Wagmi hooks

### Privacy Guarantees
- **Balances**: Fully encrypted on-chain, only viewable by owner with decryption
- **Transfers**: Amount is encrypted, only sender and recipient can decrypt
- **Total Supply**: Optional public visibility per token configuration
- **Mint Counts**: Public for limit enforcement, but amounts are confidential

## Limitations & Known Issues

- Currently supports Sepolia testnet only (FHEVM deployment required)
- Decimals fixed at 0 for simplified UX
- IPFS gateway dependency for icon display
- User decryption requires manual signing (cannot be automated)
- Public mint enforces fixed amount per transaction

## Future Enhancements

- Multi-network support (mainnet, other L2s with FHEVM)
- Advanced tokenomics (vesting schedules, dynamic pricing)
- Token trading/swap interface
- Governance voting with encrypted ballots
- Mobile-responsive improvements
- Token analytics dashboard



## License

MIT License - see contract headers for details

## Support

For issues, questions, or contributions, please open an issue in the repository.

---

**Built with privacy in mind. Powered by Zama FHEVM.**
