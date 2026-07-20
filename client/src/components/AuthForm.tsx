//client/src/components/AuthForm.tsx
import React, { useState } from 'react';
import { loginAPI, registerAPI } from '../api/auth';

interface AuthFormProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  // isRegister가 true면 회원가입 모드, false면 로그인 모드
  const [isRegister, setIsRegister] = useState<boolean>(false);
  
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      if (isRegister) {
        // 회원가입 진행
        const result = await registerAPI({ email, password, nickname });
        alert(result.message);
        // 가입 완료 후 로그인 모드로 자동 전환
        setIsRegister(false);
        setPassword('');
      } else {
        // 로그인 진행
        const result = await loginAPI({ email, password });
        alert(result.message);
        onAuthSuccess(result.user); // 상위 컴포넌트로 로그인 성공한 유저 정보 전달
      }
    } catch (error: any) {
      // Axios 에러 핸들링 (백엔드에서 보낸 에러 메시지 추출)
      const msg = error.response?.data?.message || '문제가 발생했습니다. 다시 시도해 주세요.';
      setErrorMessage(msg);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{isRegister ? '회원가입' : '로그인'}</h2>
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        {isRegister && (
          <input
            type="text"
            placeholder="게임 닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            style={styles.input}
          />
        )}

        {errorMessage && <p style={styles.error}>{errorMessage}</p>}

        <button type="submit" style={styles.button}>
          {isRegister ? '가입하기' : '로그인'}
        </button>
      </form>

      <div style={styles.switchText}>
        {isRegister ? '이미 계정이 있으신가요?' : '처음이신가요?'}
        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setErrorMessage('');
          }}
          style={styles.linkButton}
        >
          {isRegister ? '로그인하러 가기' : '회원가입하러 가기'}
        </button>
      </div>
    </div>
  );
}

// 가볍게 쓸 수 있는 인라인 스타일 정의
const styles = {
  container: {
    width: '320px',
    margin: '50px auto',
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    fontFamily: 'sans-serif',
  },
  title: {
    textAlign: 'center' as const,
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  input: {
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  button: {
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
  },
  error: {
    color: 'red',
    fontSize: '12px',
    margin: '0',
  },
  switchText: {
    marginTop: '15px',
    fontSize: '13px',
    textAlign: 'center' as const,
    color: '#555',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0',
    marginLeft: '5px',
    fontSize: '13px',
  },
};