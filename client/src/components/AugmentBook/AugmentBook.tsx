// client/src/components/AugmentBook/AugmentBook.tsx
import React from 'react';
import { AUGMENT_BOOK } from './augmentData';
import { BottomNav } from '../Game/BottomNav';

interface AugmentBookProps {
  onHomeClick: () => void;
  onHistoryClick: () => void;
  onProfileClick: () => void;
}

export default function AugmentBook({ onHomeClick, onHistoryClick, onProfileClick }: AugmentBookProps) {
  return (
    <div className="phone">
      <div className="pad flex-col flex-1" style={{ gap: '10px' }}>
        <div className="row between">
            <div className="row" style={{ gap: '10px' }}>
                <span onClick={onHomeClick} style={{ cursor: 'pointer', fontSize: '20px' }}>←</span>
                <b style={{ fontSize: '18px' }}>증강도감</b>
            </div>
            <span className="muted" style={{ fontSize: '13px' }}>{AUGMENT_BOOK.length}종</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            overflowY: 'auto',
          }}
        >
          {AUGMENT_BOOK.map((aug) => (
            <div
              key={aug.id}
              className="list-item"
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '14px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fff',
                  border: '1.5px solid var(--card-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                }}
              >
                {aug.icon}
              </div>
              <b style={{ fontSize: '14px' }}>{aug.name}</b>
              <span className="muted" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                {aug.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav
        onHomeClick={onHomeClick}
        onHistoryClick={onHistoryClick}
        onProfileClick={onProfileClick}
      />
    </div>
  );
}