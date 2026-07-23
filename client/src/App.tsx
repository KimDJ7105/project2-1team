// client/src/App.tsx
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import AuthPage from './pages/AuthPage';
import { LobbyPage } from './pages/LobbyPage';
import { getMeAPI, logoutAPI } from './api/auth';
import { getProfile } from './api/profileApi';
import { GamePage } from './pages/GamePage';
import { WaitingRoomPage } from './pages/WaitingRoomPage';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileLoaded, setProfileLoaded] = useState<boolean>(false);

  // 현재 입장한 방 상태 관리 (null이면 로비, 객체가 있으면 게임방)
  const [currentRoom, setCurrentRoom] = useState<{ 
  roomId: string; 
  roomTitle: string; 
  players?: any[]; 
  } | null>(() => {
    const savedRoom = sessionStorage.getItem('currentRoom');
    return savedRoom ? JSON.parse(savedRoom) : null;
  });

  // 게임 시작 여부 상태 관리 (false면 대기방, true면 본 게임 화면)
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    const savedPlaying = sessionStorage.getItem('isPlaying');
    return savedPlaying === 'true';
  });

  const API_BASE_URL = import.meta.env.VITE_SERVER_URL
  // 방 상태나 게임 상태가 변경될 때마다 세션스토리지에 동기화
  const handleRoomChange = (roomInfo: any) => {
    setCurrentRoom(roomInfo);
    if (roomInfo) {
      sessionStorage.setItem('currentRoom', JSON.stringify(roomInfo));
    } else {
      sessionStorage.removeItem('currentRoom');
    }
  };

  const handlePlayingChange = (playing: boolean) => {
    setIsPlaying(playing);
    sessionStorage.setItem('isPlaying', String(playing));
  };

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
          // 먼저 기본 user 정보 설정
          let mergedUser: any = {
            ...data.user,
            token: savedToken,
          };

          // 프로필 API로 최신 nickname/profileImage를 가져와 병합
          try {
            const prof = await getProfile(data.user.userId);
            mergedUser = {
              ...mergedUser,
              nickname: prof.nickname ?? mergedUser.nickname,
              profileImage: prof.profileImage ?? mergedUser.profileImage ?? null,
            };
          } catch (err) {
            console.warn('프로필 조회 실패, 소켓 연결 이전에 계속 진행합니다.', err);
          }

          setUser(mergedUser);
          setProfileLoaded(true);
        }
      } catch (error) {
        console.error('세션 복구 실패(만료되었거나 잘못된 토큰):', error);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('currentRoom');
        sessionStorage.removeItem('isPlaying');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // 2. 소켓 연결 로직
  // 2. 소켓 연결 로직
  useEffect(() => {
    if (!user) return;
    if (!profileLoaded) return; // 프로필이 로드된 이후에만 소켓 연결

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

    // 서버가 강제로 소켓 연결을 끊었을 때의 처리를 추가합니다.
    socketInstance.on('disconnect', (reason) => {
      console.log(`[소켓 연결 종료] 사유: ${reason}`);
      
      if (reason === 'io server disconnect') {
        alert('다른 탭이나 기기에서 접속하여 기존 연결이 종료되었습니다. 안전을 위해 로그아웃됩니다.');
        
        // 브라우저에 남은 세션 정보와 상태를 초기화하여 로그인 화면으로 강제 이동시킵니다.
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('currentRoom');
        sessionStorage.removeItem('isPlaying');
        setUser(null);
        setCurrentRoom(null);
        setIsPlaying(false);
      }
    });

    // 서버에서 보내는 강제 종료 에러 메시지가 개별 페이지의 알림과 중복되지 않도록 전역에서 가로챕니다.
    socketInstance.on('game:error', (data: { message: string }) => {
      if (data.message.includes('다른 탭이나 기기')) {
        console.log('[중복 접속 오류 수신]', data.message);
      }
    });

    // 서버로부터 재연결 이벤트를 받으면 진행 중이던 방과 게임 상태로 즉시 복구
    socketInstance.on('room:reconnect', (data: { roomId: string; roomTitle: string; status: string }) => {
      console.log('[App] 탭 종료 후 재접속 감지. 기존 방으로 복귀합니다:', data);
      
      const roomObj = { roomId: data.roomId, roomTitle: data.roomTitle };
      setCurrentRoom(roomObj);
      sessionStorage.setItem('currentRoom', JSON.stringify(roomObj));

      const playing = data.status === 'playing';
      setIsPlaying(playing);
      sessionStorage.setItem('isPlaying', String(playing));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, API_BASE_URL, profileLoaded]);

  // 로그인 이후 또는 다른 경로로 user가 설정되었지만 프로필이 아직 로드되지 않은 경우
  useEffect(() => {
    if (!user) return;
    if (profileLoaded) return;

    const loadProfileOnLogin = async () => {
      try {
        const prof = await getProfile(user.userId);
        setUser((prev: any) => ({
          ...prev,
          nickname: prof.nickname ?? prev.nickname,
          profileImage: prof.profileImage ?? prev.profileImage ?? null,
        }));
      } catch (err) {
        console.warn('로그인 후 프로필 조회 실패:', err);
      } finally {
        setProfileLoaded(true);
      }
    };

    loadProfileOnLogin();
  }, [user, profileLoaded]);

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

  const handleUserUpdate = (updates: { nickname?: string; profileImage?: string | null }) => {
    setUser((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...updates,
      };
    });
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
          onUserUpdate={handleUserUpdate}
          onJoinSuccess={(roomInfo: { roomId: string; roomTitle: string; players?: any[] }) => {
            handleRoomChange(roomInfo);
            handlePlayingChange(false);
          }}
        />
      ) : !isPlaying ? (
        <WaitingRoomPage
          socket={socket}
          roomId={currentRoom.roomId}
          roomTitle={currentRoom.roomTitle}
          user={user}
          initialPlayers={currentRoom.players || []}
          onLeave={() => {
            handleRoomChange(null);
            handlePlayingChange(false);
          }}
          onStartGame={() => {
            handlePlayingChange(true);
          }}
        />
      ) : (
        <GamePage
          socket={socket}
          roomId={currentRoom.roomId}
          roomTitle={currentRoom.roomTitle}
          user={user}
          onLeave={() => {
            handleRoomChange(null);
            handlePlayingChange(false);
          }}
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