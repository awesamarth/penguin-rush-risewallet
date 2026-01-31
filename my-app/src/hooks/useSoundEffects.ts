'use client';

import { useCallback, useRef, useState } from 'react';

export function useSoundEffects() {
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  // Initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Jump sound - boing effect
  const playJump = useCallback(() => {
    if (isMuted) return;

    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [isMuted, getAudioContext]);

  // Victory sound - ascending chime
  const playVictory = useCallback(() => {
    if (isMuted) return;

    const audioContext = getAudioContext();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

      const startTime = audioContext.currentTime + index * 0.15;
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }, [isMuted, getAudioContext]);

  // Game Over sound - descending tones
  const playGameOver = useCallback(() => {
    if (isMuted) return;

    const audioContext = getAudioContext();
    const notes = [392, 349.23, 293.66]; // G4, F4, D4

    notes.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

      const startTime = audioContext.currentTime + index * 0.2;
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.4);
    });
  }, [isMuted, getAudioContext]);

  // Start game sound - quick rising tone
  const playStartGame = useCallback(() => {
    if (isMuted) return;

    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }, [isMuted, getAudioContext]);

  // Landing sound - small thud
  const playLanding = useCallback(() => {
    if (isMuted) return;

    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
  }, [isMuted, getAudioContext]);

  // Background music - play from file
  const playBackgroundMusic = useCallback((audioUrl: string) => {
    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio(audioUrl);
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.3;
    }

    if (!isMuted && bgMusicRef.current.paused) {
      bgMusicRef.current.play().catch(err => {
      });
    }
  }, [isMuted]);

  // Stop background music
  const stopBackgroundMusic = useCallback(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current.currentTime = 0;
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (!isMuted && bgMusicRef.current) {
      bgMusicRef.current.pause();
    } else if (isMuted && bgMusicRef.current) {
      bgMusicRef.current.play();
    }
  }, [isMuted]);

  return {
    isMuted,
    toggleMute,
    playJump,
    playVictory,
    playGameOver,
    playStartGame,
    playLanding,
    playBackgroundMusic,
    stopBackgroundMusic
  };
}
