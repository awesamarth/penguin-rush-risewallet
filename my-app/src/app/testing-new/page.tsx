'use client';

import { useEffect, useState } from 'react';
import { useConnect, useAccount, useConnectors, useChainId, useDisconnect } from 'wagmi';
import { Hooks } from 'rise-wallet/wagmi';
import { P256, PublicKey, Signature, Hex } from 'ox';
import { encodeFunctionData } from 'viem';
import { CONTRACT_ADDRESS, CONTRACT_ABI, FUNCTION_SELECTORS } from '@/lib/contract';

export default function TestingPage() {
  const { address, connector } = useAccount();
  const chainId = useChainId();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const grantPermissions = Hooks.useGrantPermissions();
  const { data: permissions, isLoading: permissionsLoading } = Hooks.usePermissions();

  const [mounted, setMounted] = useState(false);
  const [hasSessionKey, setHasSessionKey] = useState(false);
  const [sessionKeyData, setSessionKeyData] = useState<{ privateKey: string; publicKey: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);

    // Load session key from localStorage
    if (typeof window !== "undefined") {
      const localStorageKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("penguin.sessionKey.")
      );

      for (const storageKey of localStorageKeys) {
        try {
          const keyData = localStorage.getItem(storageKey);
          if (keyData) {
            const parsed = JSON.parse(keyData);
            if (parsed.publicKey && parsed.privateKey) {
              setSessionKeyData({ privateKey: parsed.privateKey, publicKey: parsed.publicKey });
              setHasSessionKey(true);
              addLog(`✅ Loaded session key: ${parsed.publicKey.slice(0, 16)}...`);
              break;
            }
          }
        } catch (e) {
          // Ignore invalid entries
        }
      }
    }
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const handleConnect = async () => {
    const rwConnector = connectors.find(c => c.id === 'com.risechain.wallet');
    if (rwConnector) {
      connect.mutate({ connector: rwConnector });
      addLog('🔌 Connecting to RISE Wallet...');
    }
  };

  const handleDisconnect = () => {
    disconnect.mutate();
    addLog('🔌 Disconnected');
  };

  // Check if current session key is still valid
  const isSessionKeyValid = () => {
    if (!sessionKeyData || !permissions || permissionsLoading) return false;

    const now = Math.floor(Date.now() / 1000);
    const isValid = permissions.some(
      (perm: any) =>
        perm.key?.publicKey === sessionKeyData.publicKey &&
        perm.expiry > now
    );

    if (!isValid) {
      addLog('❌ Session key is expired or invalid!');
    }

    return isValid;
  };

  const handleCreateSessionKey = async () => {
    try {
      addLog('🔑 Creating session key...');
      const privateKey = P256.randomPrivateKey();
      const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), { includePrefix: false });

      localStorage.setItem(
        `penguin.sessionKey.${publicKey}`,
        JSON.stringify({ privateKey, publicKey })
      );

      const permissionParams = {
        key: { publicKey, type: 'p256' as const },
        expiry: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
        feeToken: {
          limit: "1" as any,
          symbol: "ETH"
        },
        permissions: {
          calls: [
            { to: CONTRACT_ADDRESS, signature: FUNCTION_SELECTORS.jump },
            { to: CONTRACT_ADDRESS, signature: FUNCTION_SELECTORS.startGame },
            { to: CONTRACT_ADDRESS, signature: FUNCTION_SELECTORS.storeNewHighScore }
          ]
        }
      };

      addLog(`📋 Permissions: jump, startGame, storeNewHighScore`);

      //@ts-ignore
      await grantPermissions.mutateAsync(permissionParams);

      const keyData = { privateKey, publicKey };
      setSessionKeyData(keyData);
      setHasSessionKey(true);
      addLog(`✅ Session key created: ${publicKey.slice(0, 16)}...${publicKey.slice(-8)}`);
    } catch (error: any) {
      addLog(`❌ Session key error: ${error.message || error}`);
      console.error('Session key error:', error);
    }
  };

  const handleClearSessionKey = () => {
    if (sessionKeyData) {
      localStorage.removeItem(`penguin.sessionKey.${sessionKeyData.publicKey}`);
      setSessionKeyData(null);
      setHasSessionKey(false);
      addLog('🗑️ Session key cleared');
    }
  };

  const executeWithSessionKey = async (calls: any[], functionName: string) => {
    if (!sessionKeyData || !connector || !address) {
      addLog('❌ Missing: sessionKeyData, connector, or address');
      return null;
    }

    try {
      addLog(`📤 Executing ${functionName}...`);
      const provider = (await connector.getProvider()) as any;

      const prepareResult = await provider.request({
        method: 'wallet_prepareCalls',
        params: [{
          calls,
          chainId: Hex.fromNumber(chainId),
          from: address,
          atomicRequired: true,
          key: {
            publicKey: sessionKeyData.publicKey,
            type: 'p256'
          }
        }]
      });

      addLog(`🔨 Prepared call with nonce: ${prepareResult.context.nonce}`);

      const { digest, capabilities, ...request } = prepareResult;

      const signature = Signature.toHex(
        P256.sign({
          payload: digest as `0x${string}`,
          privateKey: sessionKeyData.privateKey as `0x${string}`
        })
      );

      addLog(`✍️ Signed with session key`);

      const result = await provider.request({
        method: 'wallet_sendPreparedCalls',
        params: [{
          ...request,
          ...(capabilities ? { capabilities } : {}),
          signature
        }]
      });

      const callId = Array.isArray(result) && result.length > 0 ? result[0].id : result.id;
      addLog(`📨 Call ID: ${callId}`);

      if (callId) {
        const callStatus = await provider.request({
          method: 'wallet_getCallsStatus',
          params: [callId]
        });

        addLog(`📊 Status: ${callStatus.status}`);

        if (callStatus.status === 500) {
          addLog('❌ Transaction failed with status 500');

          // Try to decode error from logs
          if (callStatus.receipts?.[0]?.logs?.[0]?.data) {
            const errorData = callStatus.receipts[0].logs[0].data;
            addLog(`🔍 Error data: ${errorData.slice(0, 20)}...`);
          }
        } else if (callStatus.status === 200) {
          addLog('✅ Transaction succeeded!');
        }

        const txHash = callStatus.receipts?.[0]?.transactionHash;
        if (txHash) {
          addLog(`🔗 TX: ${txHash}`);
        }

        return { result, callStatus, txHash };
      }

      return { result };
    } catch (error: any) {
      addLog(`❌ Error: ${error.message || error}`);
      console.error('Execution error:', error);
      return null;
    }
  };

  const testJump = async () => {
    if (!address || !hasSessionKey) return;
    if (!isSessionKeyValid()) return;

    const funcAbi = CONTRACT_ABI.find(f => f.name === 'jump');
    if (!funcAbi) return;

    const data = encodeFunctionData({ abi: [funcAbi], functionName: 'jump' });
    const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

    await executeWithSessionKey(calls, 'jump()');
  };

  const testStartGame = async () => {
    if (!address || !hasSessionKey) return;
    if (!isSessionKeyValid()) return;

    const funcAbi = CONTRACT_ABI.find(f => f.name === 'startGame');
    if (!funcAbi) return;

    const data = encodeFunctionData({ abi: [funcAbi], functionName: 'startGame' });
    const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

    await executeWithSessionKey(calls, 'startGame()');
  };

  const testStoreHighScore = async () => {
    if (!address || !hasSessionKey) return;
    if (!isSessionKeyValid()) return;

    const funcAbi = CONTRACT_ABI.find(f => f.name === 'storeNewHighScore');
    if (!funcAbi) return;

    const testScore = BigInt(Math.floor(Math.random() * 1000));
    const data = encodeFunctionData({
      abi: [funcAbi],
      functionName: 'storeNewHighScore',
      args: [testScore]
    });
    const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

    addLog(`🎯 Testing with score: ${testScore}`);
    await executeWithSessionKey(calls, 'storeNewHighScore(uint256)');
  };

  const shortAddr = mounted && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🧪 Session Key Testing</h1>

        {/* Connection Status */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">Connection</h2>
          {mounted && address ? (
            <div className="space-y-2">
              <p className="text-green-400">✅ Connected: {shortAddr}</p>
              <button
                onClick={handleDisconnect}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-white font-semibold transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <p className="text-yellow-400 mb-2">⚠️ Not connected</p>
              <button
                onClick={handleConnect}
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-semibold transition"
              >
                Connect RISE Wallet
              </button>
            </div>
          )}
        </div>

        {/* Session Key Management */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">Session Key</h2>
          {hasSessionKey && sessionKeyData ? (
            <div className="space-y-3">
              <p className="text-green-400">✅ Session key active</p>
              <p className="text-sm text-gray-300 font-mono bg-black/30 p-2 rounded break-all">
                {sessionKeyData.publicKey}
              </p>
              <button
                onClick={handleClearSessionKey}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-white font-semibold transition"
              >
                Clear Session Key
              </button>
            </div>
          ) : (
            <div>
              <p className="text-yellow-400 mb-2">⚠️ No session key</p>
              <button
                onClick={handleCreateSessionKey}
                disabled={!address}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white font-semibold transition"
              >
                Create Session Key (24 hours)
              </button>
            </div>
          )}
        </div>

        {/* Test Buttons */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">Test Functions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={testStartGame}
              disabled={!hasSessionKey}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-6 py-4 rounded-lg text-white font-bold transition"
            >
              🎮 Start Game
            </button>
            <button
              onClick={testJump}
              disabled={!hasSessionKey}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-6 py-4 rounded-lg text-white font-bold transition"
            >
              🦘 Jump
            </button>
            <button
              onClick={testStoreHighScore}
              disabled={!hasSessionKey}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-6 py-4 rounded-lg text-white font-bold transition"
            >
              💾 Store Score
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-white text-sm transition"
            >
              Clear Logs
            </button>
          </div>
          <div className="bg-black/50 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300 mb-1">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
