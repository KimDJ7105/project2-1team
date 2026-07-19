// client/src/pages/AuthPage.tsx
import React, { useState, useEffect } from 'react';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';
import '../assets/styles/AuthStyles.css';

interface AuthPageProps {
  onAuthSuccess: (user: any) => void;
}

// 오목판 위 돌 시퀀스 데이터
const sequence = [
  { x: 14, y: 12, c: 'black', aug: false },
  { x: 34, y: 18, c: 'white', aug: false },
  { x: 22, y: 24, c: 'black', aug: false },
  { x: 46, y: 14, c: 'white', aug: true },
  { x: 10, y: 30, c: 'black', aug: false },
  { x: 60, y: 22, c: 'white', aug: false },
  { x: 36, y: 34, c: 'black', aug: true },
  { x: 70, y: 16, c: 'white', aug: false },
  { x: 55, y: 36, c: 'black', aug: false },
  { x: 80, y: 28, c: 'white', aug: false }
];

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [activeScreen, setActiveScreen] = useState<'login' | 'signup'>('login');
  const [visibleCount, setVisibleCount] = useState<number>(0);

  useEffect(() => {
    // 사용자가 애니메이션 축소(감소) 설정을 켰다면 전체 노출
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCount(sequence.length);
      return;
    }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (i < sequence.length) {
        setVisibleCount((prev) => prev + 1);
        i++;
        timer = setTimeout(step, 550);
      } else {
        timer = setTimeout(() => {
          setVisibleCount(0);
          i = 0;
          timer = setTimeout(step, 500);
        }, 1600);
      }
    };

    step();

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="phone">
      {/* TOP: BOARD HERO */}
      <div className="board-panel">
        <div className="board-grid"></div>
        <div className="board-frame"></div>
        <div id="stones">
          {sequence.map((stone, idx) => (
            <div
              key={idx}
              className={`stone ${stone.c}${stone.aug ? ' augmented' : ''}${idx < visibleCount ? ' show' : ''}`}
              style={{
                left: `${stone.x}%`,
                top: `${stone.y}%`
              }}
            ></div>
          ))}
        </div>

        <div className="brand-card">
          <p className="eyebrow">AUGMENTED OMOK</p>
          <h1>증강오목</h1>
          <p>다섯 알을 잇는 순간, 예상 못 한 한 수가 끼어듭니다.</p>
        </div>
      </div>

      {/* BOTTOM: AUTH PANEL */}
      <div className="auth-panel">
        <div className="auth-card">
          {activeScreen === 'login' ? (
            <LoginForm 
              onSwitch={() => setActiveScreen('signup')} 
              onAuthSuccess={onAuthSuccess} 
            />
          ) : (
            <SignupForm onSwitch={() => setActiveScreen('login')} />
          )}
        </div>
      </div>
    </div>
  );
}