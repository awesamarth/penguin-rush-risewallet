export interface PlayerStats {
  totalGames: bigint;
  totalJumps: bigint;
  highScore: bigint;
  bestDistance: bigint;
  mountainReaches: bigint;
}

export interface GlobalStats {
  totalGames: bigint;
  totalJumps: bigint;
  totalPlayers: bigint;
}

export interface Leaderboard {
  players: `0x${string}`[];
  scores: bigint[];
}

export interface SessionKeyData {
  privateKey: Uint8Array;
  publicKey: string;
  expiry: number;
}

export interface TransactionLog {
  id: string;
  message: string;
  status: 'pending' | 'success' | 'error';
  hash?: string;
}
