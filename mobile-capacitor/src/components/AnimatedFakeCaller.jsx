import React from 'react';

export default function AnimatedFakeCaller({ callerName = 'Mom' }) {
  const initial = callerName.trim().charAt(0).toUpperCase() || 'M';

  return (
    <div className="relative flex flex-col items-center justify-center py-10">
      <div className="relative flex items-center justify-center w-44 h-44">
        <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />

        <div className="absolute inset-4 rounded-full bg-purple-400/20 animate-pulse" />

        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
          <span className="text-6xl text-white font-bold">
            {initial}
          </span>
        </div>
      </div>

      <p className="text-xl font-semibold text-white mt-5">
        {callerName}
      </p>

      <div className="flex items-end justify-center gap-1 h-8 mt-4">
        {[1, 2, 3, 4, 5].map((bar) => (
          <span
            key={bar}
            className="w-1.5 rounded-full bg-green-400 animate-pulse"
            style={{
              height: `${10 + bar * 4}px`,
              animationDelay: `${bar * 120}ms`
            }}
          />
        ))}
      </div>

      <p className="text-xs text-gray-300 mt-3">
        Virtual Caller · Simulated Video
      </p>
    </div>
  );
}
