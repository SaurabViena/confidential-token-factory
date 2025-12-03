// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC7984} from "openzeppelin-confidential-contracts/contracts/token/ERC7984/ERC7984.sol";

/// @title ConfidentialMintableToken
/// @notice Public-mintable confidential token based on OpenZeppelin Confidential (ERC-7984) + Zama FHEVM
/// @dev Uses integer units (decimals=0) for simplified frontend interaction; supply and mint quotas are uint64
contract ConfidentialMintableToken is ZamaEthereumConfig, ERC7984, AccessControl {
    // --- Metadata & Config ---
    string public description; // Optional description
    string public iconCid; // IPFS CID for icon

    address public creator; // Token creator
    address public pendingCreator; // Two-step transfer
    modifier onlyCreator() {
        require(msg.sender == creator, "not creator");
        _;
    }

    uint64 public immutable maxSupply; // Maximum supply cap
    uint16 public immutable creatorReserveBps; // Creator reserve percentage (basis points, 10000=100%)
    uint16 public immutable publicMintBps; // Public mint percentage for users (basis points)
    uint64 public immutable perMintAmount; // Amount per mint
    uint32 public perWalletMintLimit; // Per-wallet mint limit, 0 means unlimited (governance updatable)

    uint64 public immutable publicAllocation; // Total allocation for public mint
    bool public immutable isTotalSupplyPublic; // Whether total minted is public (optional)

    // --- Public Mint Governance ---
    bool public publicMintEnabled = true; // Enabled by default for backward compatibility
    uint64 public publicMintStart; // 0 means no start time restriction
    uint64 public publicMintEnd; // 0 means no end time restriction
    bytes32 public publicMintMerkleRoot; // 0 means whitelist disabled

    // --- Runtime Control & Lists ---
    bool public paused; // Only restricts mint/burn/publicMint in this contract
    mapping(address => bool) public blocklisted;

    // --- Metadata Governance ---
    bool public metadataFrozen;

    // --- State ---
    uint64 private _totalMinted; // Total minted (for tracking)
    uint64 private _publicMinted; // Public minted amount
    mapping(address => uint32) public walletMintCount; // Mint count per address

    event PublicMint(address indexed minter, uint64 amount);
    event CreatorTransferProposed(address indexed currentCreator, address indexed newCreator);
    event CreatorTransferAccepted(address indexed prevCreator, address indexed newCreator);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event BlocklistUpdated(address indexed account, bool blocked);
    event PublicMintGovernanceUpdated(
        bool enabled,
        uint64 start,
        uint64 end,
        uint32 perWalletLimit,
        bytes32 merkleRoot
    );
    event MetadataUpdated(string description, string iconCid);
    event MetadataFrozen();
    event GovernanceRenounced(address indexed by, bool atCreation);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory description_,
        string memory iconCid_,
        uint64 maxSupply_,
        uint16 creatorReserveBps_,
        uint16 publicMintBps_,
        uint64 perMintAmount_,
        uint32 perWalletMintLimit_,
        address creator_,
        bool isTotalSupplyPublic_,
        bool renounceOnCreation_
    ) ERC7984(name_, symbol_, _buildTokenURI(iconCid_)) {
        require(maxSupply_ > 0, "maxSupply=0");
        require(maxSupply_ <= type(uint64).max, "supply>uint64");
        require(perMintAmount_ > 0, "perMint=0");
        require(uint256(creatorReserveBps_) + uint256(publicMintBps_) <= 10000, "bps>100%");

        description = description_;
        iconCid = iconCid_;
        creator = creator_;
        _grantRole(DEFAULT_ADMIN_ROLE, creator_);
        maxSupply = maxSupply_;
        creatorReserveBps = creatorReserveBps_;
        publicMintBps = publicMintBps_;
        perMintAmount = perMintAmount_;
        perWalletMintLimit = perWalletMintLimit_;
        isTotalSupplyPublic = isTotalSupplyPublic_;

        uint64 reserve = uint64((uint256(maxSupply_) * creatorReserveBps_) / 10000);
        uint64 allocation = uint64((uint256(maxSupply_) * publicMintBps_) / 10000);
        publicAllocation = allocation;

        // Mint creator reserve
        if (reserve > 0) {
            euint64 delta = FHE.asEuint64(reserve);
            _mint(creator_, delta);
            _totalMinted += reserve;
        }

        if (renounceOnCreation_) {
            _renounceCreator(true);
        }
    }

    /// @notice Integer units for easy frontend minting with denominations like 100/500/1000
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @dev Override supportsInterface to resolve multiple inheritance conflict
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC7984, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice Get token metadata URI
    function tokenURI() public view returns (string memory) {
        return _buildTokenURI(iconCid);
    }

    /// @dev Build token URI, supports IPFS and HTTP links
    function _buildTokenURI(string memory cid) internal pure returns (string memory) {
        if (bytes(cid).length == 0) return "";
        if (bytes(cid).length > 7 && _compareStrings(substring(cid, 0, 7), "ipfs://")) {
            return cid;
        }
        if (
            bytes(cid).length > 8 &&
            (_compareStrings(substring(cid, 0, 8), "https://") || _compareStrings(substring(cid, 0, 7), "http://"))
        ) {
            return cid;
        }
        return string(abi.encodePacked("ipfs://", cid));
    }

    function substring(string memory str, uint start, uint end) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(end - start);
        for (uint i = start; i < end; i++) {
            result[i - start] = strBytes[i];
        }
        return string(result);
    }

    function _compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    // --- Two-step Creator Transfer ---
    function proposeCreator(address newCreator) external onlyCreator {
        require(newCreator != address(0), "zero addr");
        pendingCreator = newCreator;
        emit CreatorTransferProposed(creator, newCreator);
    }

    function acceptCreator() external {
        require(msg.sender == pendingCreator, "not pending");
        address prev = creator;
        creator = pendingCreator;
        pendingCreator = address(0);
        _grantRole(DEFAULT_ADMIN_ROLE, creator);
        _revokeRole(DEFAULT_ADMIN_ROLE, prev);
        emit CreatorTransferAccepted(prev, creator);
    }

    function renounceCreator() external onlyCreator {
        _renounceCreator(false);
    }

    function _renounceCreator(bool atCreation) internal {
        address prev = creator;
        if (prev != address(0)) {
            _revokeRole(DEFAULT_ADMIN_ROLE, prev);
        }
        creator = address(0);
        pendingCreator = address(0);
        emit GovernanceRenounced(prev, atCreation);
    }

    // --- Runtime Control ---
    function pause() external {
        require(msg.sender == creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "no pause role");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external {
        require(msg.sender == creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "no pause role");
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setBlocklisted(address account, bool blocked) external onlyCreator {
        blocklisted[account] = blocked;
        emit BlocklistUpdated(account, blocked);
    }

    function setPublicMintGovernance(
        bool enabled,
        uint64 start,
        uint64 end,
        uint32 perWalletLimit,
        bytes32 merkleRoot
    ) external onlyCreator {
        publicMintEnabled = enabled;
        publicMintStart = start;
        publicMintEnd = end;
        perWalletMintLimit = perWalletLimit;
        publicMintMerkleRoot = merkleRoot;
        emit PublicMintGovernanceUpdated(enabled, start, end, perWalletLimit, merkleRoot);
    }

    // --- Metadata Governance ---
    function updateMetadata(string calldata newDescription, string calldata newIconCid) external onlyCreator {
        require(!metadataFrozen, "frozen");
        description = newDescription;
        iconCid = newIconCid;
        emit MetadataUpdated(newDescription, newIconCid);
    }

    function freezeMetadata() external onlyCreator {
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    /// @notice Public mint fixed amount, limited by total allocation and per-wallet count
    function publicMint() external {
        bytes32[] memory empty;
        _publicMintWithProof(empty);
    }

    /// @notice Public mint with whitelist proof (optional)
    function publicMint(bytes32[] calldata merkleProof) external {
        _publicMintWithProof(merkleProof);
    }

    function _publicMintWithProof(bytes32[] memory merkleProof) internal {
        require(!paused, "paused");
        require(!blocklisted[msg.sender], "blocklisted");
        require(publicMintEnabled, "pmint off");
        if (publicMintStart != 0) require(block.timestamp >= publicMintStart, "too early");
        if (publicMintEnd != 0) require(block.timestamp <= publicMintEnd, "too late");
        if (publicMintMerkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(MerkleProof.verify(merkleProof, publicMintMerkleRoot, leaf), "not in wl");
        }
        if (perWalletMintLimit != 0) {
            require(walletMintCount[msg.sender] < perWalletMintLimit, "mint limit");
        }

        require(_publicMinted + perMintAmount <= publicAllocation, "sold out");
        require(_totalMinted + perMintAmount <= maxSupply, "cap exceeded");

        euint64 delta = FHE.asEuint64(perMintAmount);
        _mint(msg.sender, delta);

        unchecked {
            _publicMinted += perMintAmount;
            _totalMinted += perMintAmount;
            if (perWalletMintLimit != 0) {
                walletMintCount[msg.sender] += 1;
            }
        }

        emit PublicMint(msg.sender, perMintAmount);
    }

    /// @notice Creator mint (limited by maxSupply)
    function mint(address to, uint64 amount) external onlyCreator {
        require(!paused, "paused");
        require(!blocklisted[to], "blocklisted");
        require(amount > 0, "amount=0");
        require(_totalMinted + amount <= maxSupply, "cap exceeded");
        euint64 delta = FHE.asEuint64(amount);
        _mint(to, delta);
        _totalMinted += amount;
    }

    /// @notice Creator burn
    function burn(address from, uint64 amount) external onlyCreator {
        require(!paused, "paused");
        require(!blocklisted[from], "blocklisted");
        require(amount > 0, "amount=0");
        euint64 delta = FHE.asEuint64(amount);
        _burn(from, delta);
        require(_totalMinted >= amount, "underflow");
        unchecked {
            _totalMinted -= amount;
        }
    }

    /// @notice Brief config info for frontend batch read
    function getConfig()
        external
        view
        returns (
            string memory name_,
            string memory symbol_,
            string memory description_,
            string memory iconCid_,
            uint64 maxSupply_,
            uint16 creatorReserveBps_,
            uint16 publicMintBps_,
            uint64 perMintAmount_,
            uint32 perWalletMintLimit_,
            uint64 publicAllocation_,
            uint64 totalMinted_,
            uint64 publicMinted_
        )
    {
        name_ = name();
        symbol_ = symbol();
        description_ = description;
        iconCid_ = iconCid;
        maxSupply_ = maxSupply;
        creatorReserveBps_ = creatorReserveBps;
        publicMintBps_ = publicMintBps;
        perMintAmount_ = perMintAmount;
        perWalletMintLimit_ = perWalletMintLimit;
        publicAllocation_ = publicAllocation;
        totalMinted_ = _totalMinted;
        publicMinted_ = _publicMinted;
    }

    /// @notice Total supply visibility set at construction; only creator can view if not public
    function totalMinted() external view returns (uint64) {
        if (!isTotalSupplyPublic) require(msg.sender == creator, "no view perm");
        return _totalMinted;
    }

    function publicMinted() external view returns (uint64) {
        if (!isTotalSupplyPublic) require(msg.sender == creator, "no view perm");
        return _publicMinted;
    }

    /// @notice Only returns sold out status (does not reveal exact values)
    function isSoldOut() external view returns (bool) {
        return _publicMinted >= publicAllocation || _totalMinted >= maxSupply;
    }

    /// @notice Asset rescue (admin only)
    function rescueETH(address payable to, uint256 amount) external onlyCreator {
        require(to != address(0), "zero addr");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "eth send fail");
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyCreator {
        require(to != address(0), "zero addr");
        require(IERC20(token).transfer(to, amount), "erc20 send fail");
    }
}
