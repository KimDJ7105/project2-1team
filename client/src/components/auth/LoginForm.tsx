// client/src/components/auth/LoginForm.tsx
import React, { useState } from 'react';

interface LoginFormProps {
  onSwitch: () => void;
  onAuthSuccess: (user: any) => void;
}

export default function LoginForm({ onSwitch, onAuthSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // 환경변수가 없을 시 기본 포트 8080 서버 연동
  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '로그인에 실패했습니다.');
      }

      localStorage.setItem('accessToken', data.token);
      
      setMessage('로그인에 성공했습니다! 잠시 후 이동합니다.');
      setIsError(false);

      setTimeout(() => {
        onAuthSuccess({
          ...data.user,
          token: data.token
        });
      }, 1000);

    } catch (error: any) {
      setMessage(error.message);
      setIsError(true);
    }
  };

  return (
    <div className="screen active">
      <div className="icon-row">
        <span className="mini-stone b"></span>
        <span className="mini-stone w"></span>
      </div>
      <p className="panel-title">로그인</p>
      
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            type="password"
            placeholder="비밀번호"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <p className={`form-msg ${!isError && message ? 'ok' : ''}`} aria-live="polite">
          {message}
        </p>

        <button type="submit" className="cute-btn teal">로그인</button>
      </form>
      
      <p className="switch-line">
        계정이 없으신가요?{' '}
        <button type="button" onClick={onSwitch}>
          회원가입
        </button>
      </p>
    </div>
  );
}