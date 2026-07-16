import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import userRoutes from './routes/userRoutes'; // 라우터 가져오기

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

// 3. 실시간 소켓 통신 이벤트 리스너 정의
io.on('connection', (socket) => {
  console.log(`[Server] 누군가 무전기 채널에 접속했습니다! (소켓 ID: ${socket.id})`);

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
    console.log(`[Server] 접속이 끊겼습니다. (소켓 ID: ${socket.id})`);
  });
});

// 4. 8080 포트에서 서버 구동
const PORT = 8080;
httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`[Server] 오목 백엔드 서버 가동 중! (포트: ${PORT})`);
  console.log(`=========================================`);
});