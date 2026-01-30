export const CONTRACT_ADDRESS = '0x40Abb5D752b60Ef6f8Ce1f73cFAe47761662f912' as const;
export const RISE_CHAIN_ID = 11155931;
export const RISE_CHAIN_ID_HEX = '0xAA39DB';
export const RPC_URL = 'https://testnet.riselabs.xyz';
export const EXPLORER_URL = 'https://explorer.testnet.riselabs.xyz';

export const CONTRACT_ABI = [
  {
    name: 'jump',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'startGame',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'storeNewHighScore',
    type: 'function',
    inputs: [{ name: '_newHighscore', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'getPlayerStats',
    type: 'function',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: '_totalGames', type: 'uint256' },
      { name: '_totalJumps', type: 'uint256' },
      { name: '_highScore', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    name: 'getAllPlayers',
    type: 'function',
    inputs: [],
    outputs: [
      { name: '', type: 'address[]' }
    ],
    stateMutability: 'view'
  },
  {
    name: 'getGlobalStats',
    type: 'function',
    inputs: [],
    outputs: [
      { name: '_totalGames', type: 'uint256' },
      { name: '_totalJumps', type: 'uint256' },
      { name: '_totalPlayers', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    name: 'highScores',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'totalJumps',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'totalGames',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  }
] as const;

export const FUNCTION_SELECTORS = {
  jump: '0x8f6c696b',
  startGame: '0xd65ab5f2',
  storeNewHighScore: '0x546d2c48'
} as const;
