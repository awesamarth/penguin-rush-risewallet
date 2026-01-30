'use client';

import { useEffect, useRef, useState } from 'react';
import { useSoundEffects } from '@/hooks/useSoundEffects';

export default function TestGame() {
  const [gameRunning, setGameRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [distanceToMountain, setDistanceToMountain] = useState(50);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showGameOverScreen, setShowGameOverScreen] = useState(false);
  const [showWinScreen, setShowWinScreen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const { isMuted, toggleMute, playJump, playVictory, playGameOver, playStartGame, playLanding, playBackgroundMusic, stopBackgroundMusic } = useSoundEffects();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef({
    penguin: { x: 100, y: 280, width: 35, height: 45, velocityY: 0, isJumping: false, onIceberg: false, currentIceberg: null as any },
    icebergs: [] as any[],
    stars: [] as any[],
    waveOffset: 0,
    mountainX: 750,
    gameSpeed: 5,
  });

  const initGame = () => {
    const state = gameStateRef.current;
    state.penguin = { x: 100, y: 305, width: 35, height: 45, velocityY: 0, isJumping: false, onIceberg: true, currentIceberg: null };
    state.gameSpeed = 0.8;
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
    setDistanceToMountain(50);
  };

  const createIceberg = (x: number, y: number, width?: number) => ({
    x, y, width: width || 70 + Math.random() * 50, height: 30, baseY: y,
    floatOffset: Math.random() * Math.PI * 2, floatSpeed: 0.03 + Math.random() * 0.02,
    driftDirection: Math.random() > 0.5 ? 1 : -1, driftSpeed: 0.3 + Math.random() * 0.4, scored: false
  });

  const handleStartGame = async () => {
    setShowStartScreen(false);
    setShowGameOverScreen(false);
    setShowWinScreen(false);
    initGame();
    setGameRunning(true);
    playStartGame();
    // Start background music on first interaction
    playBackgroundMusic('/sounds/bgm.mp3');
  };

  const jump = () => {
    if (!gameRunning) return;

    const { penguin } = gameStateRef.current;
    if (penguin.isJumping && !penguin.onIceberg) return;

    penguin.velocityY = -11;
    penguin.isJumping = true;
    penguin.onIceberg = false;
    penguin.currentIceberg = null;

    setScore(s => s + 5);
    playJump();
  };

  const handleGameOver = async () => {
    setGameRunning(false);
    setFinalScore(score);
    setShowGameOverScreen(true);
    playGameOver();
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
        state.gameSpeed = Math.min(3.5, 0.8 + score / 400);
        const penguin = state.penguin;
        penguin.velocityY += 0.55;
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
          // Gap scales with speed: at speed 1 = 35-45px, at speed 3.5 = ~100-130px
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

      drawGame(ctx, state);
      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [gameRunning, score]);

  const drawGame = (ctx: CanvasRenderingContext2D, state: any) => {
    ctx.clearRect(0, 0, 700, 450);

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
    if (gameRunning || showGameOverScreen) drawPenguin(ctx, state.penguin);
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
    initGame();

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameRunning]);

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a1628] to-[#1a2332] text-white flex items-center justify-center">
      <div className="relative w-175 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <canvas ref={canvasRef} width={700} height={450} onClick={jump} className="block cursor-pointer rounded-xl" />

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
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-[rgba(10,22,40,0.95)] flex flex-col items-center justify-center text-center p-5">
            <div className="text-6xl mb-4 animate-bounce">🐧</div>
            <h1 className="text-4xl mb-2.5 text-[#4fc3f7]">PENGUIN RUSH</h1>
            <p className="text-base text-[#90caf9] mb-5">Test Mode - No Blockchain</p>

            <div className="bg-white/10 px-6 py-4 rounded-xl mb-5 max-w-xs text-left text-[13px] text-[#b3e5fc]">
              <p className="my-1.5"><strong className="text-[#4fc3f7]">🎯 Goal:</strong> Jump to the mountain!</p>
              <p className="my-1.5"><strong className="text-[#4fc3f7]">🖱️ Click/Space:</strong> Jump</p>
            </div>

            <button onClick={handleStartGame}
              className="bg-linear-to-br from-[#4fc3f7] to-[#29b6f6] border-none px-10 py-4 text-lg font-bold text-[#0a1628] rounded-full transition-all shadow-[0_10px_30px_rgba(79,195,247,0.4)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(79,195,247,0.6)]">
              🚀 START GAME
            </button>
          </div>
        )}

        {showGameOverScreen && (
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-[rgba(10,22,40,0.95)] flex flex-col items-center justify-center text-center p-5">
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-3xl text-[#ef5350] mb-4">SPLASH!</h2>
            <p className="text-xl mb-2">Score: <span className="text-[#4fc3f7] text-3xl">{finalScore}</span></p>
            <button onClick={handleStartGame}
              className="bg-linear-to-br from-[#4fc3f7] to-[#29b6f6] border-none px-10 py-4 text-lg font-bold text-[#0a1628] rounded-full transition-all shadow-[0_10px_30px_rgba(79,195,247,0.4)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(79,195,247,0.6)]">
              🔄 Play Again
            </button>
          </div>
        )}

        {showWinScreen && (
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-[rgba(10,22,40,0.95)] flex flex-col items-center justify-center text-center p-5">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl text-[#4ade80] mb-4">YOU WON!</h2>
            <p className="text-lg text-[#90caf9] mb-2">You reached the mountain!</p>
            <p className="text-xl mb-2">Final Score: <span className="text-[#4fc3f7] text-3xl">{finalScore}</span></p>
            <button onClick={handleStartGame}
              className="bg-linear-to-br from-[#4fc3f7] to-[#29b6f6] border-none px-10 py-4 text-lg font-bold text-[#0a1628] rounded-full transition-all shadow-[0_10px_30px_rgba(79,195,247,0.4)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(79,195,247,0.6)]">
              🔄 Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
