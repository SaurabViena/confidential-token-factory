// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ConfidentialMintableToken} from "./ConfidentialMintableToken.sol";

/// @title TokenFactory
/// @notice 仅创建基于 OZ ERC7984 + FHEVM 的机密代币
contract TokenFactory {
    struct TokenInfo {
        address token;
        address creator;
        string name;
        string symbol;
        string description;
        string iconCid;
        uint64 maxSupply;
        uint16 creatorReserveBps;
        uint16 publicMintBps;
        uint64 perMintAmount;
        uint32 perWalletMintLimit;
        uint64 publicAllocation;
    }

    TokenInfo[] public tokens;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol);

    function getTokensCount() external view returns (uint256) {
        return tokens.length;
    }

    function getTokenInfo(uint256 idx) external view returns (TokenInfo memory) {
        return tokens[idx];
    }

    function createToken(
        string memory name_,
        string memory symbol_,
        string memory description_,
        string memory iconCid_,
        uint64 maxSupply_,
        uint16 creatorReserveBps_,
        uint16 publicMintBps_,
        uint64 perMintAmount_,
        uint32 perWalletMintLimit_,
        bool isTotalSupplyPublic_,
        bool renounceOnCreation_
    ) external returns (address token) {
        require(bytes(name_).length > 0 && bytes(symbol_).length > 0, "bad meta");

        ConfidentialMintableToken t = new ConfidentialMintableToken(
            name_,
            symbol_,
            description_,
            iconCid_,
            maxSupply_,
            creatorReserveBps_,
            publicMintBps_,
            perMintAmount_,
            perWalletMintLimit_,
            msg.sender,
            isTotalSupplyPublic_,
            renounceOnCreation_
        );
        token = address(t);

        uint64 allocation = t.publicAllocation();
        tokens.push(
            TokenInfo({
                token: token,
                creator: msg.sender,
                name: name_,
                symbol: symbol_,
                description: description_,
                iconCid: iconCid_,
                maxSupply: maxSupply_,
                creatorReserveBps: creatorReserveBps_,
                publicMintBps: publicMintBps_,
                perMintAmount: perMintAmount_,
                perWalletMintLimit: perWalletMintLimit_,
                publicAllocation: allocation
            })
        );

        emit TokenCreated(token, msg.sender, name_, symbol_);
    }
}
