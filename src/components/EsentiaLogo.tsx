import React from 'react';

export const EsentiaLogo = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 400 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="200" fill="#0b2a30" />
    <defs>
      <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00a859" />
        <stop offset="100%" stopColor="#00ff00" />
      </linearGradient>
    </defs>
    <rect x="35" y="40" width="330" height="18" fill="url(#greenGradient)" />
    <text x="35" y="105" fontFamily="system-ui, -apple-system, sans-serif" fontSize="48" fontWeight="800" fill="white" letterSpacing="1">ESENTIA</text>
    <text x="35" y="128" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="600" fill="white">Energy Systems</text>
    <rect x="35" y="145" width="330" height="18" fill="url(#greenGradient)" />
  </svg>
);
