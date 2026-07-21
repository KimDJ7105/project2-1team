// client/src/App.tsx
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import AuthPage from './pages/AuthPage';
import { LobbyPage } from './pages/LobbyPage';
import { getMeAPI, logoutAPI } from './api/auth';
import { GamePage } from './pages/GamePage';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 현재 입장한 방 상태 관리 (null이면 로비, 객체가 있으면 게임방)
  const [currentRoom, setCurrentRoom] = useState<{ roomId: string; roomTitle: string } | null>(null);

  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

  // 1. 세션 복구 로직
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem('token');
      
      if (!savedToken || savedToken === 'undefined') {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getMeAPI(savedToken);
        
        if (data && data.user) {
          setUser({
            ...data.user,
            token: savedToken
          });
        }
      } catch (error) {
        console.error('세션 복구 실패(만료되었거나 잘못된 토큰):', error);
        sessionStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // 2. 소켓 연결 로직
  useEffect(() => {
    if (!user) return;
    
    const currentToken = user.token || sessionStorage.getItem('token');

    if (!currentToken || currentToken === 'undefined') {
      console.log(`[소켓 에러]: 유효한 토큰을 찾을 수 없습니다. 다시 시도해 주세요.`);
      return;
    }

    console.log('소켓 연결 시도 토큰 수신 확인:', currentToken);

    const socketInstance = io(API_BASE_URL, {
      withCredentials: true,
      auth: {
        token: currentToken
      }
    });

    socketInstance.on('connect', () => {
      console.log(`[소켓 연결 완료] ${user.nickname}님 환영합니다! (ID: ${socketInstance.id})`);
    });

    socketInstance.on('connect_error', (err) => {
      console.error(`[소켓 연결 에러]: ${err.message}`);
    });

    socketInstance.on('disconnect', () => {
      console.log('[소켓 연결 종료]');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, API_BASE_URL]);

  // 3. 로그아웃 처리 로직
  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (err) {
      console.error('로그아웃 서버 통신 실패', err);
    }

    setUser(null);
    setCurrentRoom(null);
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    sessionStorage.removeItem('token');
  };

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>인증 정보를 확인 중입니다...</div>;
  }

  // 4. 화면 전환 라우팅 로직 
  return (
    <div style={styles.appContainer}>
      {!user ? (
        <AuthPage onAuthSuccess={(loggedInUser) => setUser(loggedInUser)} />
      ) : !currentRoom ? (
        <LobbyPage
          socket={socket}
          user={user}
          onLogout={handleLogout}
          onJoinSuccess={(roomInfo) => setCurrentRoom(roomInfo)}
        />
      ) : (
        <GamePage
          socket={socket}
          roomId={currentRoom.roomId}
          roomTitle={currentRoom.roomTitle}
          user={user}
          onLeave={() => setCurrentRoom(null)}
        />
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    fontFamily: "'Gowun Dodum', sans-serif",
    width: '100%',
    margin: '0 auto',
    backgroundColor: '#e9e2d3',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
  },
};