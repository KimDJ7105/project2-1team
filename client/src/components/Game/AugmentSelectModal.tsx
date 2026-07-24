// client/src/components/Game/AugmentSelectModal.tsx

import React, { useState } from 'react';

export interface AugmentOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGEND';
}

interface AugmentSelectModalProps {
  options: AugmentOption[];
  onSelectComplete: (selectedId: string) => void;
}

export const AugmentSelectModal: React.FC<AugmentSelectModalProps> = ({
  options,
  onSelectComplete,
}) => {
  // 기본값으로 첫 번째 증강을 선택 상태로 두기
  const [selectedId, setSelectedId] = useState<string>(options[0]?.id || '');
  const [isWaiting, setIsWaiting] = useState<boolean>(false);

  const handleComplete = () => {
    if (!selectedId) {
      alert('증강을 선택해주세요.');
      return;
    }
    setIsWaiting(true);
    onSelectComplete(selectedId);
  };

  if (isWaiting) {
    return (
      <div className="aug-modal-overlay">
        <div className="aug-modal-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <p className="aug-modal-title">상대방을 기다리는 중...</p>
          <p className="aug-hint">상대 플레이어가 증강을 선택하고 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aug-modal-overlay">
      <div className="aug-modal-container">
        <p className="aug-modal-title">증강을 선택하세요</p>

        {/* 세로로 3개가 배치되는 리스트 영역 */}
        <div className="aug-card-list">
          {options.map((item) => {
            const isSelected = item.id === selectedId;
            const rarityClass = item.rarity.toLowerCase();

            return (
              <div
                key={item.id}
                className={`aug-card-item ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="aug-icon-box">{item.icon}</div>
                <div className="aug-info-box">
                  <span className="aug-name">{item.name}</span>
                  <p className="aug-desc">{item.description}</p>
                </div>
                <span className={`aug-rarity ${rarityClass}`}>
                  {item.rarity}
                </span>
              </div>
            );
          })}
        </div>

        <p className="aug-hint">카드를 눌러 하나를 고르면 바로 적용돼요</p>

        <button className="game-btn" style={{ width: '100%' }} onClick={handleComplete}>
          선택 완료
        </button>
      </div>
    </div>
  );
};