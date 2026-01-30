'use client';

import { useState, useEffect } from 'react';

interface NavbarProps {
  address: string | null;
  hasSessionKey: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
}

export function Navbar({ address, hasSessionKey, onConnect, onDisconnect, isConnecting }: NavbarProps) {
  const [mounted, setMounted] = useState(false);
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted) {
    return (
      <header className="flex justify-between items-center p-4 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2.5 text-xl font-bold">
          🐧 <span className="text-[#4fc3f7]">Penguin Rush</span>
        </div>
        <div className="flex items-center gap-2.5 bg-linear-to-br from-[#7c3aed] to-[#4f46e5] px-3.5 py-1.5 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 bg-[#4ade80] rounded-full animate-pulse" />
          RISE Testnet
        </div>
        <div className="w-50" />
      </header>
    );
  }

  return (
    <header className="flex justify-between items-center p-4 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-2.5 text-xl font-bold">
        🐧 <span className="text-[#4fc3f7]">Penguin Rush</span>
      </div>

      <div className="flex items-center gap-2.5 bg-linear-to-br from-[#7c3aed] to-[#4f46e5] px-3.5 py-1.5 rounded-full text-xs font-semibold">
        <span className="w-2 h-2 bg-[#4ade80] rounded-full animate-pulse" />
        RISE Testnet
      </div>

      {address ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white bg-linear-to-br from-[#4ade80] to-[#22c55e]">
            🔐 {shortAddr}
            <span className="bg-linear-to-br from-[#a855f7] to-[#7c3aed] px-2.5 py-1 rounded-xl text-[10px] ml-2">
              RISE
            </span>
          </div>

          <button
            onClick={handleCopy}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border-none transition-all cursor-pointer"
            title="Copy address"
          >
            {copied ? '✓' : '📋'}
          </button>

          <button
            onClick={onDisconnect}
            className="px-4 py-2.5 rounded-full bg-red-500/80 hover:bg-red-500 border-none font-semibold text-white transition-all cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white border-none transition-all bg-linear-to-br from-[#a855f7] to-[#7c3aed] hover:-translate-y-0.5 hover:shadow-[0_5px_20px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            '🔐 Connect RISE Wallet'
          )}
        </button>
      )}
    </header>
  );
}
