// client/src/components/auth/SignupForm.tsx
import React, { useState } from 'react';
import { registerAPI } from '../../api/auth';

interface SignupFormProps {
  onSwitch: () => void;
}

export default function SignupForm({ onSwitch }: SignupFormProps) {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    try {
      await registerAPI({ nickname, email, password });

      setMessage('회원가입이 완료되었습니다! 로그인해 주세요.');
      setIsError(false);
      
      setTimeout(() => {
        onSwitch();
      }, 1500);

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || '회원가입에 실패했습니다.';
      setMessage(errorMessage);
      setIsError(true);
    }
  };

  return (
    <div className="screen active">
      <div className="icon-row">
        <span className="mini-stone w"></span>
        <span className="mini-stone b"></span>
      </div>
      <p className="panel-title">회원가입</p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signup-nickname">닉네임</label>
          <input
            id="signup-nickname"
            type="text"
            placeholder="게임 닉네임"
            required
            maxLength={50}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="signup-email">이메일</label>
          <input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="signup-password">비밀번호</label>
          <input
            id="signup-password"
            type="password"
            placeholder="8자 이상"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <p className={`form-msg ${!isError && message ? 'ok' : ''}`} aria-live="polite">
          {message}
        </p>

        <button type="submit" className="cute-btn">회원가입</button>
      </form>

      <p className="switch-line">
        이미 계정이 있으신가요?{' '}
        <button type="button" onClick={onSwitch}>
          로그인
        </button>
      </p>
    </div>
  );
}