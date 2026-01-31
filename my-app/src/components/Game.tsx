'use client';

import { useEffect, useRef, useState } from 'react';
import { useConnect, useAccount, useConnectors, useSendCalls, useChainId, useDisconnect } from 'wagmi';
import { Hooks } from 'rise-wallet/wagmi';
import { P256, PublicKey, Signature, Hex } from 'ox';
import { encodeFunctionData, hashTypedData } from 'viem';
import { Navbar } from './Navbar';
import { Leaderboard } from './Leaderboard';
import { CONTRACT_ADDRESS, CONTRACT_ABI, FUNCTION_SELECTORS } from '@/lib/contract';
import { useSoundEffects } from '@/hooks/useSoundEffects';

export default function Game() {
  const { address, connector } = useAccount();
  const chainId = useChainId();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const sendCalls = useSendCalls();
  const grantPermissions = Hooks.useGrantPermissions();
  const { data: permissions, isLoading: permissionsLoading } = Hooks.usePermissions();

  const [mounted, setMounted] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [distanceToMountain, setDistanceToMountain] = useState(500);
  const [jumpCount, setJumpCount] = useState(0);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showGameOverScreen, setShowGameOverScreen] = useState(false);
  const [showWinScreen, setShowWinScreen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalJumpCount, setFinalJumpCount] = useState(0);
  const [hasSessionKey, setHasSessionKey] = useState(false);
  const [sessionKeyData, setSessionKeyData] = useState<{ privateKey: string; publicKey: string; expiry: number } | null>(null);
  const lastJumpTime = useRef(0);
  const refreshLeaderboard = useRef<(() => Promise<void>) | null>(null);

  const { isMuted, toggleMute, playJump, playVictory, playGameOver, playStartGame, playLanding, playBackgroundMusic } = useSoundEffects();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef({
    penguin: { x: 100, y: 305, width: 35, height: 45, velocityY: 0, isJumping: false, onIceberg: true, currentIceberg: null as any },
    icebergs: [] as any[],
    stars: [] as any[],
    waveOffset: 0,
    mountainX: 750,
    gameSpeed: 0.8,
  });

  const handleConnect = async () => {
    const rwConnector = connectors.find(c => c.id === 'com.risechain.wallet');
    if (rwConnector) {
      connect.mutate({ connector: rwConnector });
    }
  };

  const handleDisconnect = () => {
    disconnect.mutate();
  };

  // Check if current session key is still valid
  const isSessionKeyValid = () => {
    if (!sessionKeyData) return false;

    const now = Math.floor(Date.now() / 1000);
    return sessionKeyData.expiry > now;
  };

  const handleCreateSessionKey = async () => {
    try {
      const privateKey = P256.randomPrivateKey();
      const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), { includePrefix: false });

      const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours

      localStorage.setItem(
        `penguin.sessionKey.${publicKey}`,
        JSON.stringify({ privateKey, publicKey, expiry })
      );

      const permissionParams = {
        key: { publicKey, type: 'p256' as const },
        expiry,
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

      //@ts-ignore
      await grantPermissions.mutateAsync(permissionParams);

      const keyData = { privateKey, publicKey, expiry };
      setSessionKeyData(keyData);
      setHasSessionKey(true);

      // Send a dummy transaction to initialize nonce
      console.log('Sending dummy transaction to sync nonce...');
      try {
        const funcAbi = CONTRACT_ABI.find(f => f.name === 'jump');
        if (funcAbi && connector && address) {
          const data = encodeFunctionData({ abi: [funcAbi], functionName: 'jump' });
          const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

          const provider = (await connector.getProvider()) as any;
          const prepareResult = await provider.request({
            method: 'wallet_prepareCalls',
            params: [{
              calls,
              chainId: Hex.fromNumber(chainId),
              from: address,
              atomicRequired: true,
              key: { publicKey, type: 'p256' }
            }]
          });

          const { digest, capabilities, ...request } = prepareResult;
          const signature = Signature.toHex(
            P256.sign({
              payload: digest as `0x${string}`,
              privateKey: privateKey as `0x${string}`
            })
          );

          await provider.request({
            method: 'wallet_sendPreparedCalls',
            params: [{ ...request, ...(capabilities ? { capabilities } : {}), signature }]
          });

          console.log('Dummy transaction sent - nonce synced!');
        }
      } catch (e) {
      }
    } catch (error) {
      console.error('Session key error:', error);
    }
  };

  const executeWithSessionKey = async (calls: any[]) => {
    if (!sessionKeyData || !connector || !address) return null;

    try {
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

      const { digest, capabilities, ...request } = prepareResult;

      const signature = Signature.toHex(
        P256.sign({
          payload: digest as `0x${string}`,
          privateKey: sessionKeyData.privateKey as `0x${string}`
        })
      );

      const result = await provider.request({
        method: 'wallet_sendPreparedCalls',
        params: [{
          ...request,
          ...(capabilities ? { capabilities } : {}),
          signature
        }]
      });

      const callId = Array.isArray(result) && result.length > 0 ? result[0].id : result.id;

      if (callId) {
        const callStatus = await provider.request({
          method: 'wallet_getCallsStatus',
          params: [callId]
        });



        if (callStatus.status === 500) {
          console.error('Transaction failed with status 500 (possibly nonce issue, ignoring)');
        }
        const txHash = callStatus.receipts?.[0]?.transactionHash;
        if (txHash) {
          console.log('Transaction hash:', txHash);
        }

        // Return success regardless - let the game continue
        return { result, callStatus, txHash };
      }

      return { result };
    } catch (error) {
      return null;
    }
  };

  const sendJumpTx = async () => {
    if (!address || !hasSessionKey || !sessionKeyData || !connector) return;

    try {
      const funcAbi = CONTRACT_ABI.find(f => f.name === 'jump');
      if (!funcAbi) return;

      const data = encodeFunctionData({ abi: [funcAbi], functionName: 'jump' });
      const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

      await executeWithSessionKey(calls);
    } catch (error) {
      console.error('Jump TX Error:', error);
    }
  };

  const initGame = () => {
    const state = gameStateRef.current;
    state.penguin = { x: 100, y: 305, width: 35, height: 45, velocityY: 0, isJumping: false, onIceberg: true, currentIceberg: null };
    state.gameSpeed = 1.2;
    state.mountainX = 750;
    state.waveOffset = 0;

    state.stars = [];
    for (let i = 0; i < 40; i++) {
      state.stars.push({ x: Math.random() * 700, y: Math.random() * 180, size: Math.random() * 2 + 1, twinkle: Math.random() * Math.PI * 2 });
    }

    const startIceberg = createIceberg(70, 350, 120);
    state.icebergs = [startIceberg];
    state.penguin.currentIceberg = startIceberg;
    state.penguin.y = startIceberg.y - state.penguin.height;

    let lastX = 70 + 120;
    for (let i = 0; i < 4; i++) {
      const newIceberg = createIceberg(lastX + 35 + Math.random() * 10, 320 + Math.random() * 30);
      state.icebergs.push(newIceberg);
      lastX = newIceberg.x + newIceberg.width;
    }

    setScore(0);
    setDistanceToMountain(500);
    setJumpCount(0);
  };

  const createIceberg = (x: number, y: number, width?: number) => ({
    x, y, width: width || 70 + Math.random() * 50, height: 30, baseY: y,
    floatOffset: Math.random() * Math.PI * 2, floatSpeed: 0.03 + Math.random() * 0.02,
    driftDirection: Math.random() > 0.5 ? 1 : -1, driftSpeed: 0.3 + Math.random() * 0.4, scored: false
  });

  const handleStartGame = async () => {
    if (!address) return;
    if (!hasSessionKey) return;

    // Check if session key is still valid
    if (!isSessionKeyValid()) {
      console.warn('⚠️ Session key expired or invalid');
      alert('Session key has expired! Please create a new one.');
      setHasSessionKey(false);
      return;
    }

    setShowStartScreen(false);
    setShowGameOverScreen(false);
    setShowWinScreen(false);
    initGame();
    setGameRunning(true);
    playStartGame();
    playBackgroundMusic('/sounds/bgm.mp3');

    // Call startGame() on contract
    try {
      const funcAbi = CONTRACT_ABI.find(f => f.name === 'startGame');
      if (!funcAbi) return;

      const data = encodeFunctionData({ abi: [funcAbi], functionName: 'startGame' });
      const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

      await executeWithSessionKey(calls);
    } catch (error) {
      console.error('Start game TX error:', error);
    }
  };

  const jump = () => {
    if (!gameRunning) return;

    const { penguin } = gameStateRef.current;
    if (penguin.isJumping && !penguin.onIceberg) return;

    penguin.velocityY = -11.5;
    penguin.isJumping = true;
    penguin.onIceberg = false;
    penguin.currentIceberg = null;

    setScore(s => s + 5);
    setJumpCount(j => j + 1);
    playJump();

    // Throttle tx sending - only send if 200ms has passed since last jump
    const now = Date.now();
    if (now - lastJumpTime.current > 200) {
      sendJumpTx();
      lastJumpTime.current = now;
    }
  };

  const handleGameOver = async () => {
    setGameRunning(false);
    setFinalScore(score);
    setFinalJumpCount(jumpCount);
    setShowGameOverScreen(true);
    playGameOver();

    // Store high score on contract
    if (score > 0 && address && hasSessionKey && sessionKeyData && connector) {
      try {
        const funcAbi = CONTRACT_ABI.find(f => f.name === 'storeNewHighScore');
        if (!funcAbi) return;

        const data = encodeFunctionData({
          abi: [funcAbi],
          functionName: 'storeNewHighScore',
          args: [BigInt(score)]
        });
        const calls = [{ to: CONTRACT_ADDRESS, data, value: "0x0" }];

        await executeWithSessionKey(calls);

        // Refresh leaderboard after storing score
        if (refreshLeaderboard.current) {
          await refreshLeaderboard.current();
        }
      } catch (error) {
        console.error('Store high score TX error:', error);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      const state = gameStateRef.current;

      if (gameRunning) {
        state.gameSpeed = Math.min(5.0, 1.2 + score / 300);
        const penguin = state.penguin;
        penguin.velocityY += 0.65;
        penguin.y += penguin.velocityY;

        if (penguin.onIceberg && penguin.currentIceberg) {
          penguin.y = penguin.currentIceberg.y - penguin.height;
        }

        state.icebergs.forEach((b: any) => {
          b.x -= state.gameSpeed;
          b.floatOffset += b.floatSpeed;
          b.y = b.baseY + Math.sin(b.floatOffset) * 7;
          b.baseY += b.driftDirection * b.driftSpeed * 0.25;
          if (b.baseY < 300) { b.baseY = 300; b.driftDirection = 1; }
          if (b.baseY > 370) { b.baseY = 370; b.driftDirection = -1; }
        });

        state.icebergs = state.icebergs.filter((b: any) => b.x + b.width > -40);

        if (state.icebergs.length < 5) {
          const last = state.icebergs[state.icebergs.length - 1];
          const baseGap = 30 + (state.gameSpeed * 20);
          const randomGap = Math.random() * (state.gameSpeed * 10);
          state.icebergs.push(createIceberg(last.x + last.width + baseGap + randomGap, 320 + Math.random() * 30));
        }

        setDistanceToMountain(d => {
          const newD = d - state.gameSpeed * 0.1;
          if (newD <= 0 && gameRunning) {
            setGameRunning(false);
            const bonusScore = score + 500;
            setScore(bonusScore);
            setFinalScore(bonusScore);
            setFinalJumpCount(jumpCount);
            setShowWinScreen(true);
            playVictory();
            return 0;
          }
          return newD;
        });

        state.mountainX -= state.gameSpeed * 0.25;
        state.waveOffset += 0.08;

        penguin.onIceberg = false;
        for (const berg of state.icebergs) {
          if (penguin.velocityY >= 0 && penguin.x + penguin.width > berg.x + 4 &&
              penguin.x < berg.x + berg.width - 4 && penguin.y + penguin.height > berg.y &&
              penguin.y + penguin.height < berg.y + 22) {
            penguin.y = berg.y - penguin.height;
            penguin.velocityY = 0;
            penguin.isJumping = false;
            penguin.onIceberg = true;
            penguin.currentIceberg = berg;
            if (!berg.scored) {
              setScore(s => s + 10);
              berg.scored = true;
              playLanding();
            }
            break;
          }
        }

        if (penguin.y > 410 || penguin.x < 0) handleGameOver();
      }

      drawGame(ctx, state, gameRunning);
      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [gameRunning, score]);

  const drawGame = (ctx: CanvasRenderingContext2D, state: any, isRunning: boolean) => {
    ctx.clearRect(0, 0, 700, 600);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.5, '#1a3a5c');
    skyGrad.addColorStop(1, '#2d5a7b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 700, 320);

    state.stars.forEach((s: any) => {
      s.twinkle += 0.05;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(s.twinkle) * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    drawMountain(ctx, state.mountainX);

    const waterGrad = ctx.createLinearGradient(0, 350, 0, 450);
    waterGrad.addColorStop(0, '#1565c0');
    waterGrad.addColorStop(1, '#0d47a1');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 350, 700, 100);

    ctx.fillStyle = 'rgba(66, 165, 245, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, 360);
    for (let x = 0; x <= 700; x += 20) {
      ctx.lineTo(x, 355 + Math.sin(x * 0.02 + state.waveOffset) * 7);
    }
    ctx.lineTo(700, 450);
    ctx.lineTo(0, 450);
    ctx.closePath();
    ctx.fill();

    state.icebergs.forEach((b: any) => drawIceberg(ctx, b));
    if (isRunning) drawPenguin(ctx, state.penguin);
  };

  const drawMountain = (ctx: CanvasRenderingContext2D, mx: number) => {
    ctx.fillStyle = '#3d5a80';
    ctx.beginPath();
    ctx.moveTo(mx - 80, 350);
    ctx.lineTo(mx + 15, 140);
    ctx.lineTo(mx + 110, 350);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4a6fa5';
    ctx.beginPath();
    ctx.moveTo(mx - 40, 350);
    ctx.lineTo(mx + 40, 170);
    ctx.lineTo(mx + 130, 350);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e8f4f8';
    ctx.beginPath();
    ctx.moveTo(mx + 15, 170);
    ctx.lineTo(mx + 40, 170);
    ctx.lineTo(mx + 65, 205);
    ctx.lineTo(mx + 45, 215);
    ctx.lineTo(mx + 30, 198);
    ctx.lineTo(mx + 5, 215);
    ctx.lineTo(mx - 10, 198);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef5350';
    ctx.fillRect(mx + 38, 140, 3, 30);
    ctx.beginPath();
    ctx.moveTo(mx + 41, 140);
    ctx.lineTo(mx + 60, 148);
    ctx.lineTo(mx + 41, 156);
    ctx.closePath();
    ctx.fill();
  };

  const drawIceberg = (ctx: CanvasRenderingContext2D, b: any) => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.width/2, b.y + b.height + 4, b.width/2 + 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height + 18);
    grad.addColorStop(0, '#e3f2fd');
    grad.addColorStop(0.3, '#bbdefb');
    grad.addColorStop(0.7, '#90caf9');
    grad.addColorStop(1, '#64b5f6');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(b.x + 8, b.y);
    ctx.lineTo(b.x + b.width - 8, b.y);
    ctx.lineTo(b.x + b.width + 4, b.y + b.height);
    ctx.lineTo(b.x + b.width - 12, b.y + b.height + 18);
    ctx.lineTo(b.x + 12, b.y + b.height + 18);
    ctx.lineTo(b.x - 4, b.y + b.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(b.x + 12, b.y + 4);
    ctx.lineTo(b.x + 32, b.y + 4);
    ctx.lineTo(b.x + 28, b.y + 12);
    ctx.lineTo(b.x + 12, b.y + 12);
    ctx.closePath();
    ctx.fill();
  };

  const drawPenguin = (ctx: CanvasRenderingContext2D, penguin: any) => {
    const px = penguin.x, py = penguin.y;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(px + 17, py + 27, 15, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.ellipse(px + 17, py + 29, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(px + 17, py + 9, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(px + 12, py + 7, 4, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(px + 22, py + 7, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(px + 13, py + 7, 2, 0, Math.PI * 2);
    ctx.arc(px + 23, py + 7, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.moveTo(px + 17, py + 10);
    ctx.lineTo(px + 24, py + 14);
    ctx.lineTo(px + 17, py + 17);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(px + 10, py + 44, 7, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(px + 24, py + 44, 7, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a2e';
    const wingAngle = penguin.isJumping ? Math.sin(Date.now() / 50) * 0.5 : 0;
    ctx.save();
    ctx.translate(px + 4, py + 22);
    ctx.rotate(-0.3 + wingAngle);
    ctx.fillRect(-2, 0, 7, 17);
    ctx.restore();
    ctx.save();
    ctx.translate(px + 30, py + 22);
    ctx.rotate(0.3 - wingAngle);
    ctx.fillRect(-5, 0, 7, 17);
    ctx.restore();
  };

  useEffect(() => {
    setMounted(true);
    initGame();

    // Load session key from localStorage - check all stored keys
    if (typeof window !== "undefined") {
      const localStorageKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("penguin.sessionKey.")
      );

      for (const storageKey of localStorageKeys) {
        try {
          const keyData = localStorage.getItem(storageKey);
          if (keyData) {
            const parsed = JSON.parse(keyData);
            if (parsed.publicKey && parsed.privateKey && parsed.expiry) {
              // Check if the key is still valid
              const now = Math.floor(Date.now() / 1000);
              if (parsed.expiry > now) {
                setSessionKeyData({ privateKey: parsed.privateKey, publicKey: parsed.publicKey, expiry: parsed.expiry });
                setHasSessionKey(true);
                break; // Use the first valid key found
              } else {
                // Remove expired key from localStorage
                localStorage.removeItem(storageKey);
              }
            }
          }
        } catch (e) {
          // Ignore invalid entries
        }
      }
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameRunning]);

  const shortAddr = mounted && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  return (
    <div className="min-h-screen">
      <Navbar
        address={address || null}
        hasSessionKey={hasSessionKey}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        isConnecting={connect.isPending}
      />

      <main className="flex flex-col items-center p-5 gap-5">
        <div className="flex gap-5 flex-wrap justify-center items-start">
          <div className="relative w-full max-w-[700px] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(100,200,255,0.2)]">
            <canvas ref={canvasRef} width={700} height={600} onClick={jump} className="block cursor-pointer rounded-xl" />

            <div className="absolute top-4 left-4 right-4 flex justify-between">
              <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold border border-white/20 pointer-events-none">
                ⭐ Score: <span className="text-[#4fc3f7]">{score}</span>
              </div>
              <div className="flex gap-2 items-center z-50">
                <button
                  onClick={toggleMute}
                  className="bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full text-sm font-semibold border border-white/20 hover:bg-black/80 transition pointer-events-auto"
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold border border-white/20 pointer-events-none">
                  🏔️ <span className="text-[#4fc3f7]">{Math.max(0, Math.floor(distanceToMountain))}m</span>
                </div>
              </div>
            </div>

            {showStartScreen && (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-lg flex flex-col items-center justify-center text-center p-4 overflow-y-auto">
                <div className="flex flex-col items-center max-h-full py-4">
                  <div className="text-5xl mb-3 animate-bounce">🐧</div>
                  <h1 className="text-4xl font-bold mb-2 text-white">PENGUIN RUSH</h1>
                  <p className="text-sm text-slate-300 mb-4">An on-chain game built on RISE testnet.</p>

                  <div className="bg-white/10 border border-white/20 p-4 rounded-xl mb-4 max-w-sm w-full text-left text-xs text-slate-200">
                    <h2 className="text-base font-semibold text-white mb-2 text-center">How to Play</h2>
                    <ul className="space-y-1.5">
                      <li><span className="font-semibold text-sky-300">Goal:</span> Jump from iceberg to iceberg and reach the distant mountain.</li>
                      <li><span className="font-semibold text-sky-300">Controls:</span> Click anywhere or press the Spacebar to jump.</li>
                      <li><span className="font-semibold text-sky-300">On-Chain:</span> Every jump is a real transaction on RISE testnet!</li>
                       <li><span className="font-semibold text-sky-300">Session Keys:</span> Authorize a session key to enjoy uninterrupted gameplay without popups for every jump.</li>
                    </ul>
                  </div>

                  <div className="text-xs text-slate-400 mb-4">
                    {mounted && address ? `Connected as: ${shortAddr}` : 'Please connect your RISE Wallet to play.'}
                  </div>

                {mounted && address && hasSessionKey ? (
                  <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                    <button onClick={handleStartGame}
                      className="w-full bg-sky-500 hover:bg-sky-400 border-none px-10 py-4 text-lg font-bold text-white rounded-full transition-all shadow-[0_10px_30px_rgba(79,195,247,0.4)] hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-400/40">
                      START GAME
                    </button>
                    {sessionKeyData && (
                      <div className="text-[11px] text-green-400 font-mono bg-black/30 px-3 py-1.5 rounded-md">
                        Session Key: {sessionKeyData.publicKey.slice(0, 12)}...
                      </div>
                    )}
                  </div>
                ) : mounted && address && !hasSessionKey ? (
                  <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                    <div className="bg-red-900/50 border border-red-500/50 px-6 py-4 rounded-xl text-base text-red-200">
                      A Session Key is required to play.
                    </div>
                    <button onClick={handleCreateSessionKey}
                      className="w-full bg-purple-600 hover:bg-purple-500 border-none px-8 py-3 text-base font-bold text-white rounded-full transition-all hover:-translate-y-0.5 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40">
                      Create Session Key
                    </button>
                  </div>
                ) : (
                  <button disabled
                    className="w-full max-w-sm bg-gray-600 border-none px-10 py-4 text-lg font-bold text-gray-400 rounded-full opacity-70 cursor-not-allowed">
                    Connect Wallet to Start
                  </button>
                )}
                </div>
              </div>
            )}

            {showGameOverScreen && (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-[rgba(10,22,40,0.95)] flex flex-col items-center justify-center text-center p-5">
                <div className="text-6xl mb-4">😢</div>
                <h2 className="text-3xl text-[#ef5350] mb-4">SPLASH!</h2>
                <p className="text-xl mb-2">Score: <span className="text-[#4fc3f7] text-3xl">{finalScore}</span></p>
                <p className="text-[#90caf9] my-2.5">{finalJumpCount} jumps recorded on-chain</p>
                <button onClick={handleStartGame}
                  className="bg-linear-to-br from-[#4fc3f7] to-[#29b6f6] border-none px-10 py-4 text-lg font-bold text-[#0a1628] rounded-full transition-all shadow-[0_10px_30px_rgba(79,195,247,0.4)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(79,195,247,0.6)]">
                  Play Again
                </button>
              </div>
            )}

            {showWinScreen && (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-[rgba(10,22,40,0.95)] flex flex-col items-center justify-center text-center p-5">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl text-[#4ade80] mb-4">YOU WON!</h2>
                <p className="text-lg text-[#90caf9] mb-2">You reached the mountain!</p>
                <p className="text-xl mb-2">Final Score: <span className="text-[#4fc3f7] text-3xl">{finalScore}</span></p>
                <p className="text-[#90caf9] my-2.5">{finalJumpCount} jumps recorded on-chain</p>
                <button onClick={handleStartGame}
                  className="bg-linear-to-br from-[#4fc3f7] to-[#29b6f6] border-none px-10 py-4 text-lg font-bold text-[#0a1628] rounded-full transition-all shadow-[0_10px_30px_rgba(79,195,247,0.4)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(79,195,247,0.6)]">
                  Play Again
                </button>
              </div>
            )}
          </div>

          <Leaderboard
            userAddress={address || null}
            onRefreshReady={(fn) => { refreshLeaderboard.current = fn; }}
          />
        </div>
      </main>
    </div>
  );
}
