// client/src/components/Game/BottomNav.tsx

import React, { useState } from 'react';

export const BottomNav: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');

  return (
    <div className="bottom-nav">
      <div
        className={`item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => setActiveTab('home')}
      >
        🏠<span>홈</span>
      </div>
      <div
        className={`item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => setActiveTab('history')}
      >
        📊<span>전적</span>
      </div>
      <div
        className={`item ${activeTab === 'codex' ? 'active' : ''}`}
        onClick={() => setActiveTab('codex')}
      >
        📖<span>증강도감</span>
      </div>
      <div
        className={`item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => setActiveTab('profile')}
      >
        👤<span>프로필</span>
      </div>
    </div>
  );
};