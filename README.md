# Penguin Rush 🐧⛰️

An on-chain game built on RISE Testnet with RISE Wallet integration and session keys for seamless gameplay.

**Play Live:** [https://02b3b1e2.sites.mogra.xyz/](https://02b3b1e2.sites.mogra.xyz/)

![Penguin Rush](https://img.shields.io/badge/Chain-RISE%20Testnet-blue)
![Status](https://img.shields.io/badge/Status-Live-green)

## Overview

Penguin Rush is a simple on-chain game where every jump is a blockchain transaction. Built to demonstrate RISE Chain's 3ms confirmation times and RISE Wallet's session key functionality.

**Every jump = 1 transaction on RISE Testnet**

## Features

- 🎮 **Flappy Bird-style gameplay** - Click/Space to jump over obstacles
- ⛓️ **Fully on-chain** - Every action is a blockchain transaction
- ⚡ **3ms confirmations** - RISE Chain's speed makes real-time gaming possible
- 🔑 **Session Keys** - Approve once, play without popups (RISE Wallet)
- 🏆 **On-chain leaderboard** - High scores stored in smart contract
- 💨 **Gas sponsored** - RISE Testnet sponsors transaction fees

## Tech Stack

- **Chain:** RISE Testnet (Chain ID: 11155931)
- **Wallet:** RISE Wallet with session keys
- **Contract:** Solidity (Foundry)
- **Frontend:** Vanilla HTML/JS with Canvas

## Smart Contract

**Deployed at:** `0x36057B9fe61Cf29e4cde42558f69c2b4269aB778`

```solidity
// Core functions
function startGame() external;           // Start a new game
function jump() external;                 // Record a jump (during active game)
function endGame(uint256 score) external; // End game and record score
```

## RISE Wallet Integration

### Session Keys Flow

1. **Connect** - User authenticates with passkey
2. **Grant Permissions** - User approves session key (one-time)
3. **Play** - All subsequent transactions auto-sign locally

```javascript
// Grant session key permissions for game functions
const permissions = {
    expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    permissions: [
        { type: { custom: { type: 'native-token-transfer', data: { allowance: '0x0' }}}},
        { type: { call: { to: CONTRACT_ADDRESS, signature: '0xd65ab5f2' }}}, // startGame
        { type: { call: { to: CONTRACT_ADDRESS, signature: '0x82a9eb50' }}}, // jump
        { type: { call: { to: CONTRACT_ADDRESS, signature: '0xab095a1f' }}}  // endGame
    ]
};
```

### Function Selectors

| Function | Selector |
|----------|----------|
| `startGame()` | `0xd65ab5f2` |
| `jump()` | `0x82a9eb50` |
| `endGame(uint256)` | `0xab095a1f` |

## Local Development

Just open `index.html` in a browser. The game connects to RISE Testnet RPC directly.

For contract development:
```bash
cd contracts
forge build
forge test
```

## Deploy Contract

```bash
forge create contracts/PenguinRush.sol:PenguinRush \
  --rpc-url https://testnet.riselabs.xyz \
  --private-key $PRIVATE_KEY
```

## Network Details

| Property | Value |
|----------|-------|
| Chain ID | 11155931 |
| RPC URL | https://testnet.riselabs.xyz |
| Explorer | https://explorer.testnet.riselabs.xyz |
| Currency | ETH |

## How It Works

1. **Start Game** - Calls `startGame()` on contract, initializes player state
2. **Jump** - Each jump calls `jump()` which increments on-chain jump counter
3. **Game Over** - Calls `endGame(score)` to record final score
4. **Leaderboard** - Contract stores top scores, queryable on-chain

## Session Keys Deep Dive

RISE Wallet session keys allow the game to sign transactions locally after initial permission grant:

1. Generate P256 keypair locally (stored in localStorage)
2. Call `wallet_grantPermissions` with public key + allowed functions
3. For each game action:
   - `wallet_prepareCalls` → get digest
   - Sign digest with local P256 key
   - `wallet_sendPreparedCalls` → submit signed transaction
4. No popup required for approved functions!

## Credits

Built with:
- [RISE Chain](https://riselabs.xyz) - 3ms confirmation L2
- [RISE Wallet](https://docs.risechain.com/rise-wallet) - Passkey wallet with session keys
- [Viem](https://viem.sh) - TypeScript Ethereum library

## License

MIT
