import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverResponse, setServerResponse] = useState('');

  useEffect(() => {
    // 1. 백엔드 소켓 서버(8080 포트) 연결 설정
    const newSocket = io('http://localhost:8080', {
      withCredentials: true,
    });

    // 연결 성공 시
    newSocket.on('connect', () => {
      console.log('[Client] 서버에 성공적으로 연결되었습니다! 소켓 ID:', newSocket.id);
      setIsConnected(true);
    });

    // 서버가 보낸 답신('test_response')을 수신하는 리스너
    newSocket.on('test_response', (data: { message: string }) => {
      console.log('[Client] 서버로부터 답신 수신:', data);
      setServerResponse(data.message);
    });

    // 연결 해제 시
    newSocket.on('disconnect', () => {
      console.log('[Client] 서버와 연결이 끊겼습니다.');
      setIsConnected(false);
    });

    setSocket(newSocket);

    // 컴포넌트가 꺼질 때 소켓 연결 정리
    return () => {
      newSocket.close();
    };
  }, []);

  // 버튼 클릭 시 서버로 무전 전송
  const handleButtonClick = () => {
    if (socket && isConnected) {
      console.log('[Client] 서버로 무전 신호(test_click)를 송신합니다.');
      socket.emit('test_click', {
        sender: '프론트엔드 클라이언트',
        timestamp: new Date().toISOString(),
      });
    } else {
      alert('아직 서버와 연결되지 않았습니다!');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'sans-serif',
      backgroundColor: '#f3f4f6'
    }}>
      <h1>🎮 증강 오목 실시간 통신 테스트</h1>
      
      <div style={{ margin: '20px', padding: '10px', borderRadius: '5px', backgroundColor: isConnected ? '#d1fae5' : '#fee2e2' }}>
        <strong>서버 연결 상태:</strong> {isConnected ? '🟢 연결됨' : '🔴 연결 끊김'}
      </div>

      <button 
        onClick={handleButtonClick}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontWeight: 'bold'
        }}
      >
        서버로 신호(test_click) 전송하기
      </button>

      {serverResponse && (
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: 'white' }}>
          <h3>📩 서버로부터 온 응답:</h3>
          <p>{serverResponse}</p>
        </div>
      )}
    </div>
  );
}

export default App;