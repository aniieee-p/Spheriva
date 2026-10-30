import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import welcomeBg from '../assets/welcome.png';
import welcomeWide from '../assets/welcome-wide.png';

// Wide image par dots ghumne ka rasta (image ke 1600x900 coordinates me)
const ORBIT_PATH = 'M 350 310 a 450 250 0 1 0 900 0 a 450 250 0 1 0 -900 0';
const ORBIT_DOTS = [
  { color: '#60A5FA', offset: 0 },
  { color: '#C084FC', offset: 5.3 },
  { color: '#FB923C', offset: 10.6 },
];

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  // Pehle se logged in ho to Welcome ke baad Login nahi, seedha Home
  if (!loading && isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  const goToLogin = () => navigate('/login', { replace: true });

  return (
    <div
      className="welcome-root"
      onClick={goToLogin}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') goToLogin();
      }}
      role="button"
      tabIndex={0}
      aria-label="Tap to continue to login"
    >
      <div className="welcome-stage">
        <picture>
          <source media="(min-aspect-ratio: 1/1)" srcSet={welcomeWide} />
          <img src={welcomeBg} alt="" className="welcome-bg" />
        </picture>

        <div className="welcome-shade" aria-hidden="true" />

        {/* Phone (portrait): rotating neon rings */}
        <div className="neon-ring-area" aria-hidden="true">
          <div className="neon-ring-outer">
            <span className="neon-dot-wrap" style={{ transform: 'rotate(0deg)' }}>
              <i className="neon-dot" style={{ '--c': '#60A5FA' }} />
            </span>
            <span className="neon-dot-wrap" style={{ transform: 'rotate(120deg)' }}>
              <i className="neon-dot" style={{ '--c': '#C084FC' }} />
            </span>
            <span className="neon-dot-wrap" style={{ transform: 'rotate(240deg)' }}>
              <i className="neon-dot" style={{ '--c': '#FB923C' }} />
            </span>
          </div>
          <div className="neon-ring-inner" />
        </div>

        {/* Laptop (landscape): dots orbiting the shield */}
        <svg
          className="neon-orbit"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            d={ORBIT_PATH}
            fill="none"
            stroke="rgba(147, 197, 253, 0.35)"
            strokeWidth="1.5"
            strokeDasharray="6 10"
          />
          {ORBIT_DOTS.map((dot) => (
            <g key={dot.color}>
              <animateMotion
                dur="16s"
                begin={`-${dot.offset}s`}
                repeatCount="indefinite"
                path={ORBIT_PATH}
              />
              <circle r="18" fill={dot.color} opacity="0.3" />
              <circle r="7" fill={dot.color} />
            </g>
          ))}
        </svg>

        <div className="welcome-bottom">
          <h1 className="welcome-title">Spheriva</h1>
          <p className="welcome-subtitle">Your Personal Safety Companion</p>
          <span className="welcome-tap">Tap anywhere to continue</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
