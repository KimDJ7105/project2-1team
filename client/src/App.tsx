import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import AuthForm from './components/AuthForm';

export default function App() {
  // 1. 로그인한 유저 정보를 담아둘 상태 변수
  const [user, setUser] = useState<any>(null);
  
  // 2. 기존 소켓 상태 및 로그들
  const [socket, setSocket] = useState<Socket | null>(null);
  const [log, setLog] = useState<string>('소켓 연결을 대기 중입니다...');

  // 사용자가 로그인을 완료하면 유저 정보를 세팅하고 소켓 연결을 수립합니다.
  useEffect(() => {
    if (!user) return; // 로그인 전에는 소켓을 연결하지 않습니다.

    const socketInstance = io('http://localhost:8080', {
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      setLog(`[소켓 연결 완료] ${user.nickname}님 환영합니다! (ID: ${socketInstance.id})`);
    });

    socketInstance.on('test_response', (data: { message: string }) => {
      setLog((prev) => `${prev}\n[서버 응답 수신]: ${data.message}`);
    });

    socketInstance.on('disconnect', () => {
      setLog((prev) => `${prev}\n[소켓 연결 종료]`);
    });

    setSocket(socketInstance);

    // 컴포넌트 언마운트 시 소켓 연결 해제
    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  // 서버로 테스트 패킷 신호를 보낼 버튼 핸들러
  const handleTestClick = () => {
    if (socket) {
      socket.emit('test_click', { 
        sender: user?.nickname || '무명유저', 
        text: 'Hello, Server!' 
      });
    }
  };

  // 로그아웃 처리
  const handleLogout = () => {
    setUser(null);
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setLog('소켓 연결을 대기 중입니다...');
  };

  return (
    <div style={styles.appContainer}>
      <h1 style={styles.mainTitle}>실시간 오목 게임 테스트</h1>

      {!user ? (
        // 로그인 전: 가벼운 Auth UI 노출
        <AuthForm onAuthSuccess={(loggedInUser) => setUser(loggedInUser)} />
      ) : (
        // 로그인 완료 후: 소켓 테스트 및 로그아웃 기능 화면 노출
        <div style={styles.gameArea}>
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
    fontFamily: 'sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  mainTitle: {
    textAlign: 'center' as const,
    color: '#333',
  },
  gameArea: {
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
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