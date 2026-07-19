import express from 'express';
import { initializeDatabase } from './repositories/mysqlClient';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import userRoutes from './routes/userRoutes'; // 라우터 가져오기
import { socketAuthMiddleware, AuthenticatedSocket } from './sessions/socketAuth';

const app = express();

// JSON 요청 본문을 해석하기 위한 미들웨어 설정 (필수!)
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// API 라우터 등록
app.use('/api/users', userRoutes);

const httpServer = createServer(app);

// 2. Socket.io 서버 초기화
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io 전용 인증 미들웨어 장착
io.use(socketAuthMiddleware);

// 3. 실시간 소켓 통신 이벤트 리스너 정의 (인증을 통과한 소켓만 들어옴)
io.on('connection', (socket: AuthenticatedSocket) => {
  // 인증 미들웨어에서 바인딩한 유저 정보 추출
  const userEmail = socket.user?.email;
  const userNickname = socket.user?.nickname;

  console.log(`[Server] 유저 ${userNickname}(${userEmail}) 님이 무전기 채널에 접속했습니다! (소켓 ID: ${socket.id})`);

  // 클라이언트가 'test_click'이라는 신호를 무전으로 보냈을 때 반응하는 곳
  socket.on('test_click', (data) => {
    console.log(`[Server] 클라이언트가 보낸 메시지 수신:`, data);
    
    // 신호를 잘 받았다고 다시 클라이언트에게 응답
    socket.emit('test_response', {
      message: '백엔드 서버가 무전을 잘 수신하고 응답합니다! Hello World!'
    });
  });

  // 접속이 끊겼을 때
  socket.on('disconnect', () => {
    console.log(`[Server] 유저 ${userNickname} 님의 접속이 끊겼습니다. (소켓 ID: ${socket.id})`);
  });
});

// 데이터베이스 초기화 및 서버 구동을 위한 비동기 래퍼 함수
async function startServer() {
  try {
    // 서버가 켜지기 직전에 DB 커넥션 풀을 만들고 schema.sql을 실행
    await initializeDatabase();
    console.log('[Server] 데이터베이스 초기화 및 스키마 동기화 완료.');

    const PORT = 8080;
    httpServer.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`[Server] 오목 백엔드 서버 가동 중! (포트: ${PORT})`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('[Server] 서버 구동 중 치명적인 오류가 발생했습니다:', error);
    process.exit(1); // 초기화 실패 시 프로세스 종료
  }
}

startServer();