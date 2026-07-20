// client/src/App.tsx
import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import AuthPage from './pages/AuthPage';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [log, setLog] = useState<string>('소켓 연결을 대기 중입니다...');

  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (!user) return;
    
    const currentToken = user.token || localStorage.getItem('accessToken');

    if (!currentToken || currentToken === 'undefined') {
      console.log(`[소켓 에러]: 유효한 토큰을 찾을 수 없습니다. 다시 시도해 주세요.`);
      return;
    }

    console.log('소켓 연결 시도 토큰 수신 확인:', currentToken);

    // 소켓 연결
    const socketInstance = io(API_BASE_URL, {
      withCredentials: true,
      auth: {
        token: currentToken
      }
    });

    socketInstance.on('connect', () => {
      setLog(`[소켓 연결 완료] ${user.nickname}님 환영합니다! (ID: ${socketInstance.id})`);
    });

    socketInstance.on('connect_error', (err) => {
      setLog((prev) => `${prev}\n[소켓 연결 에러]: ${err.message}`);
    });

    socketInstance.on('test_response', (data: { message: string }) => {
      setLog((prev) => `${prev}\n[서버 응답 수신]: ${data.message}`);
    });

    socketInstance.on('disconnect', () => {
      setLog((prev) => `${prev}\n[소켓 연결 종료]`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, API_BASE_URL]);

  const handleTestClick = () => {
    if (socket) {
      socket.emit('test_click', { 
        sender: user?.nickname || '무명유저', 
        text: 'Hello, Server!' 
      });
    }
  };

  const handleLogout = () => {
    setUser(null);
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setLog('소켓 연결을 대기 중입니다...');
    localStorage.removeItem('accessToken');
  };

  return (
    <div style={styles.appContainer}>
      {!user ? (
        <AuthPage onAuthSuccess={(loggedInUser) => setUser(loggedInUser)} />
      ) : (
        <div style={styles.gameArea}>
          <h1 style={styles.mainTitle}>실시간 오목 게임 테스트</h1>
          <div style={styles.profileHeader}>
            <p><strong>접속자:</strong> {user.nickname} ({user.email})</p>
            <button onClick={handleLogout} style={styles.logoutButton}>로그아웃</button>
          </div>

          <div style={styles.testControl}>
            <button onClick={handleTestClick} style={styles.testButton}>
              무전 보내기 (test_click 패킷 송신)
            </button>
          </div>

          <pre style={styles.logBox}>{log}</pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    fontFamily: "'Gowun Dodum', sans-serif",
    width: '100%',
    margin: '0 auto',
  },
  mainTitle: {
    textAlign: 'center' as const,
    color: '#333',
    fontSize: '22px',
    marginBottom: '15px',
  },
  gameArea: {
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
    maxWidth: '600px',
    margin: '40px auto 0',
  },
  profileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
    marginBottom: '20px',
  },
  logoutButton: {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  testControl: {
    marginBottom: '15px',
  },
  testButton: {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
  },
  logBox: {
    backgroundColor: '#1e1e1e',
    color: '#39ff14',
    padding: '15px',
    borderRadius: '4px',
    minHeight: '120px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    fontSize: '13px',
  },
};