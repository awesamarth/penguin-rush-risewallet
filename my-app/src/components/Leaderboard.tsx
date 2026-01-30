'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import type { Leaderboard as LeaderboardType, GlobalStats } from '@/lib/types';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '@/lib/contract';

interface LeaderboardProps {
  userAddress: string | null;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

export function Leaderboard({ userAddress, onRefreshReady }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardType | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    loadLeaderboard();
    loadGlobalStats();
  }, [userAddress]);

  useEffect(() => {
    // Expose refresh function to parent
    if (onRefreshReady) {
      onRefreshReady(async () => {
        await loadLeaderboard();
        await loadGlobalStats();
      });
    }
  }, [onRefreshReady]);

  const loadLeaderboard = async () => {
    try {
      const publicClient = createPublicClient({
        transport: http(RPC_URL),
      });

      // Get all players
      const getAllPlayersAbi = CONTRACT_ABI.find((f) => f.name === 'getAllPlayers');
      if (!getAllPlayersAbi) return;

      const allPlayersArray = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [getAllPlayersAbi],
        functionName: 'getAllPlayers',
      })) as readonly string[];

      if (!allPlayersArray || allPlayersArray.length === 0) {
        setLeaderboard({ players: [], scores: [] });
        return;
      }

      // Get high scores for all players
      const highScoresAbi = CONTRACT_ABI.find((f) => f.name === 'highScores');
      if (!highScoresAbi) return;

      const scores = await Promise.all(
        allPlayersArray.map((address) =>
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: [highScoresAbi],
            functionName: 'highScores',
            args: [address as `0x${string}`],
          })
        )
      );

      // Build leaderboard array with players and scores
      const leaderboardData = allPlayersArray.map((player, i) => ({
        address: player,
        score: scores[i] as bigint,
      }));

      // Sort by score descending
      leaderboardData.sort((a, b) => {
        if (b.score > a.score) return 1;
        if (b.score < a.score) return -1;
        return 0;
      });

      // Take top 10
      const topPlayers = leaderboardData.slice(0, 10);

      setLeaderboard({
        players: topPlayers.map((p) => p.address),
        scores: topPlayers.map((p) => p.score),
      });
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
      setLeaderboard({ players: [], scores: [] });
    }
  };

  const loadGlobalStats = async () => {
    try {
      const publicClient = createPublicClient({
        transport: http(RPC_URL),
      });

      const funcAbi = CONTRACT_ABI.find((f) => f.name === 'getGlobalStats');
      if (!funcAbi) return;

      const [totalGames, totalJumps, totalPlayers] = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [funcAbi],
        functionName: 'getGlobalStats',
      })) as readonly [bigint, bigint, bigint];

      setGlobalStats({
        totalGames,
        totalJumps,
        totalPlayers,
      });
    } catch (e) {
      console.error('Failed to load global stats:', e);
    }
  };
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10">
      <h3 className="text-sm text-[#90caf9] mb-4 flex items-center gap-2">🏆 Leaderboard</h3>
      <div>
        {!leaderboard || leaderboard.players.length === 0 ? (
          <div className="text-[#64748b] italic p-2.5 text-xs text-center">
            No players yet - be the first!
          </div>
        ) : (
          leaderboard.players.map((player, i) => (
            <div
              key={player}
              className="flex justify-between p-2 px-3 bg-black/20 rounded-lg mb-1.5 text-xs"
            >
              <span className="text-[#fbbf24] font-bold min-w-6.25">#{i + 1}</span>
              <span className="font-mono text-[#90caf9]">
                {player.slice(0, 6)}...{player.slice(-4)}
              </span>
              <span className="text-[#4fc3f7] font-bold">
                {leaderboard.scores[i].toString()}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-around text-center pt-2.5 border-t border-white/10 mt-2.5">
        <div className="text-[11px]">
          <div className="text-lg font-bold text-[#4fc3f7]">
            {globalStats ? globalStats.totalGames.toString() : '-'}
          </div>
          <div>Games</div>
        </div>
        <div className="text-[11px]">
          <div className="text-lg font-bold text-[#4fc3f7]">
            {globalStats ? globalStats.totalJumps.toString() : '-'}
          </div>
          <div>Jumps</div>
        </div>
        <div className="text-[11px]">
          <div className="text-lg font-bold text-[#4fc3f7]">
            {globalStats ? globalStats.totalPlayers.toString() : '-'}
          </div>
          <div>Players</div>
        </div>
      </div>
    </div>
  );
}
