// client/src/components/Game/BottomNav.tsx

import React, { useState } from 'react';

export const BottomNav: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');

    const labelStyle: React.CSSProperties = {
    fontSize: '15px',      // 기존보다 크게
    fontWeight: 900,       // 아주 굵게
    display: 'block',
    marginTop: '4px'
  };

  return (
    <div className="bottom-nav">
      <div
        className={`item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => setActiveTab('home')}
      >
        <span style={{ fontSize: '20px' }}>🏠</span>
        <span style={labelStyle}>홈</span>
      </div>
      <div
        className={`item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => setActiveTab('history')}
      >
        <span style={{ fontSize: '20px' }}>📊</span>
        <span style={labelStyle}>전적</span>
      </div>
      <div
        className={`item ${activeTab === 'codex' ? 'active' : ''}`}
        onClick={() => setActiveTab('codex')}
      >
        <span style={{ fontSize: '20px' }}>📖</span>
        <span style={labelStyle}>증강도감</span>
      </div>
      <div
        className={`item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => setActiveTab('profile')}
      >
        <span style={{ fontSize: '20px' }}>👤</span>
        <span style={labelStyle}>프로필</span>
      </div>
    </div>
  );
};