import "dotenv/config";
import express from 'express';
import { initializeDatabase } from './repositories/mysqlClient';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import userRoutes from './routes/userRoutes'; // 라우터 가져오기
import { socketAuthMiddleware, AuthenticatedSocket } from './sessions/socketAuth';
import { disconnectTimerManager } from './sessions/disconnectTimerManager';
import { redisSessionManager } from './sessions/redisSessionManager';
import { SCRoomSummary } from './shared/types/game_data';
import { gameRoomManager } from './rooms/GameRoom';
import profileRoutes from './routes/profileRoutes';
import activeConfig from './config/configLoader';
import { userStateRepositoryImpl } from './repositories/mysqlUserStateRepository';
import { userRepository, userStateRepository } from './repositories';
import gameRecordRoutes from "./routes/gameRecordRoutes";
import { gameRecordRepositoryImpl } from "./repositories/mysqlGameRecordRepository";
import { AUGMENT_MAP } from './shared/data/augments';

const app = express();

// JSON 요청 본문을 해석하기 위한 미들웨어 설정 (필수!)
app.use(express.json());

const CLIENT_URL = activeConfig.client.url;

app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

// ALB Health Check용 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API 라우터 등록
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use("/api/game-records", gameRecordRoutes);
const httpServer = createServer(app);

// 2. Socket.io 서버 초기화
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io 전용 인증 미들웨어 장착
io.use(socketAuthMiddleware);

// 3. 실시간 소켓 통신 이벤트 리스너 정의 (인증을 통과한 소켓만 들어옴)
io.on('connection', (socket: AuthenticatedSocket) => {
  // 인증 미들웨어에서 바인딩한 유저 정보 추출
  const userId = socket.user?.userId;
  if (userId === undefined) return;
  const userEmail = socket.user?.email;
  const userNickname = socket.user?.nickname;

  console.log(`[Server] 유저 ${userNickname}(${userEmail}) 님이 무전기 채널에 접속했습니다! (소켓 ID: ${socket.id})`);
  
  // 새로고침 등으로 5초 이내에 재연결된 경우 타이머 취소
  if (userEmail && disconnectTimerManager.has(userEmail)) {
    disconnectTimerManager.clear(userEmail);
    console.log(`[세션 유지] ${userNickname}(${userEmail}) 님 재연결 감지 (삭제 예약 취소)`);
  }

  // 클라이언트가 'test_click'이라는 신호를 무전으로 보냈을 때 반응하는 곳
  socket.on('test_click', (data) => {
    console.log(`[Server] 클라이언트가 보낸 메시지 수신:`, data);
    
    // 신호를 잘 받았다고 다시 클라이언트에게 응답
    socket.emit('test_response', {
      message: '백엔드 서버가 무전을 잘 수신하고 응답합니다! Hello World!'
    });
  });

  // 접속이 끊겼을 때
  socket.on('disconnect', async () => {
    console.log(`[Server] 유저 ${userNickname} 님의 접속이 끊겼습니다. (소켓 ID: ${socket.id})`);

    // 참여 중이던 방이 있는지 확인하고 퇴장 처리하여 유령 플레이어 방지
    const allRooms = gameRoomManager.getAllRooms();
    for (const room of allRooms) {
      // Map의 values에서 현재 끊긴 소켓 ID나 이메일이 일치하는 유저가 있는지 확인
      const player = Array.from(room.players.values()).find(
        (p) => p.socketId === socket.id || (userEmail && p.email === userEmail)
      );

      if (player) {
        console.log(`[Room] 접속 종료로 인한 방(${room.roomId}) 자동 퇴장 처리: ${player.nickname}`);
        //leaveRoom 메서드가 내부적으로 소켓 ID를 대조해 플레이어를 제거하고, 0명이면 방을 삭제함
        gameRoomManager.leaveRoom(room.roomId, player.socketId);
        
        // 남은 사람들에게 업데이트 알림
        const remainingRoom = gameRoomManager.getRoom(room.roomId);
        if (remainingRoom && remainingRoom.players.size > 0) {
          io.to(room.roomId).emit('room:update', { players: Array.from(remainingRoom.players.values()) });
          const updatedRoom = {
            roomId: remainingRoom.roomId,
            roomTitle: remainingRoom.roomTitle,
            playerCount: remainingRoom.players.size,
            status: remainingRoom.status
          };
          await redisSessionManager.saveRoom(room.roomId, updatedRoom);
        } else {
          // 남은 사람이 없으면 방 삭제
          await redisSessionManager.deleteRoom(room.roomId);
        }
        
        // 로비에 갱신된 방 목록 전송
        const roomsData = await redisSessionManager.getAllRooms();
        const roomList: SCRoomSummary[] = roomsData
          .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
          .filter((r) => r.status !== 'finished');
        io.emit('room:list', roomList);
        break;
      }
    }

    if (!userEmail) return;

    // 5초 대기 후 redisSessionManager를 통해 세션 및 인덱스 키 정상 파기
    const timer = setTimeout(async () => {
      try {
        const sessionId = await redisSessionManager.getActiveSessionByEmail(userEmail);
        if (sessionId) {
          await redisSessionManager.destroySession(sessionId);
          console.log(`[세션 정리 완료] 탭 종료 5초 경과로 세션 파기: ${userEmail}`);
        }
      } catch (error) {
        console.error(`[세션 정리 오류]:`, error);
      } finally {
        disconnectTimerManager.clear(userEmail);
      }
    }, 5000);

    disconnectTimerManager.set(userEmail, timer);
  });

  // 방 목록 조회 요청 처리
  socket.on('room:list', async () => {
    try {
      // 1. Redis에서 'game_rooms' 해시의 모든 값을 가져옴
      // hvals는 방 ID를 키로 가진 모든 JSON 데이터(방 정보)를 배열로 반환
      const roomsData = await redisSessionManager.getAllRooms();
    
      // 2. 문자열 데이터를 객체(SCRoomSummary)로 변환
      const roomList: SCRoomSummary[] = roomsData
        .map((data: string) => JSON.parse(data) as SCRoomSummary)
        .filter((room) => room.status !== 'finished');
    
      // 3. 클라이언트에 전송
      socket.emit('room:list', roomList);
    } catch (err) {
      console.error('방 목록 조회 실패:', err);
    }
  });

  socket.on('room:create', async (data: any) => {
    try {
    const titleValue = data.roomTitle || data.title;

    // 알파벳과 숫자로 구성된 5자리 무작위 문자열 생성
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    for (let i = 0; i < 5; i++) {
      randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 방 제목과 난수를 조합하여 고유한 방 ID 생성
    const roomId = `${titleValue}_${randomId}`;

    // 메모리에 룸 인스턴스 생성 및 생성자 참가 처리
    const roomInstance = gameRoomManager.createRoom(roomId, titleValue);
    if (userEmail && userNickname) {
      console.log('서버: 방 생성 성공 이벤트 발송 테스트', roomId);
      roomInstance.addPlayer(userId, userEmail, userNickname, socket.id);
      socket.join(roomId); // Socket.io 룸 채널 입장
    }

    // 클라이언트의 Room 인터페이스와 일치하는 객체 생성
    const newRoom = {
      roomId: roomId,
      roomTitle: titleValue,
      playerCount: 1, // 방 생성자가 최초 1인으로 참가하므로 1로 설정
      status: 'waiting'
    };

    socket.emit('room:join:success', { 
      roomId: roomId, 
      roomTitle: titleValue 
    });
    io.to(roomId).emit('room:update', { players: Array.from(roomInstance.players.values()) });

    // Redis에 방 데이터 저장
    await redisSessionManager.saveRoom(roomId, newRoom);

    // 전체 방 목록을 다시 조회하여 접속 중인 모든 클라이언트에게 갱신된 목록 전송
    const roomsData = await redisSessionManager.getAllRooms();
    const roomList : SCRoomSummary[] = roomsData
      .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
      .filter((r) => r.status !== 'finished');

    io.emit('room:list', roomList);
    } catch (err) {
      console.error('방 생성 에러:', err);
    }

  });

  // 방 참가 이벤트 처리 
  socket.on('room:join', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      if (!userEmail || !userNickname) {
        socket.emit('room:join:fail', { message: '인증 정보가 없습니다.' });
        return;
      }

      // 1. 메모리에서 룸 인스턴스 조회
      const roomInstance = gameRoomManager.getRoom(roomId);
      if (!roomInstance) {
        socket.emit('room:join:fail', { message: '존재하지 않거나 이미 종료된 방입니다.' });
        return;
      }

      // 2. 룸 인스턴스에 플레이어 추가 시도 (인원 초과 시 false 반환)
      const success = roomInstance.addPlayer(userId, userEmail, userNickname, socket.id);
      if (!success) {
        socket.emit('room:join:fail', { message: '방 인원이 가득 찼습니다.' });
        return;
      }

      // 3. Socket.io 룸 채널 입장
      socket.join(roomId);

      // 4. Redis의 방 정보 업데이트 (참가자 수 동기화)
      const updatedRoom = {
        roomId: roomInstance.roomId,
        roomTitle: roomInstance.roomTitle,
        playerCount: roomInstance.players.size,
        status: roomInstance.status
      };
      await redisSessionManager.saveRoom(roomId, updatedRoom);

      // 5. 입장 성공 알림 및 해당 방에 입장 완료 데이터 전송
      socket.emit('room:join:success', { 
        roomId: roomInstance.roomId, 
        roomTitle: roomInstance.roomTitle 
      });
      io.to(roomId).emit('room:update', { players: Array.from(roomInstance.players.values()) });
    
      // 6. 전체 로비 유저들에게 변경된 인원수 반영을 위해 방 목록 다시 전송
      const roomsData = await redisSessionManager.getAllRooms();
      const roomList: SCRoomSummary[] = roomsData
        .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
        .filter((r) => r.status !== 'finished');
      io.emit('room:list', roomList);

      console.log(`[Room] ${userNickname}(${userEmail}) 님이 방(${roomId})에 입장했습니다.`);
    } catch (err) {
      console.error('방 입장 처리 중 오류:', err);
      socket.emit('room:join:fail', { message: '방 입장 처리 중 서버 오류가 발생했습니다.' });
    }
  });

  // 준비 완료 이벤트 
  socket.on('room:ready', ({ roomId }) => {
    const room = gameRoomManager.getRoom(roomId);
    if (!room) return;

    // Map 구조의 값들을 배열로 변환하여 소켓 ID로 플레이어 검색
    const playersArray = Array.from(room.players.values());
    const player = playersArray.find(p => p.socketId === socket.id);
    if (player) {
      player.isReady = !player.isReady; // 준비 취소도 가능하도록 토글
    }

    // 방에 있는 모든 사람에게 현재 인원 및 준비 상태 브로드캐스트
    io.to(roomId).emit('room:update', { players: Array.from(room.players.values()) });

    // 2명이 모두 모였고, 2명 모두 준비 완료 상태인지 확인 (size와 every 사용)
    const allReady = room.players.size === 2 && Array.from(room.players.values()).every(p => p.isReady);
    if (allReady) {
      // 게임 시작 상태로 변경 및 알림
      room.status = 'playing';
      room.turnCount = 1;
      
      // 1. 플레이어 목록을 배열로 가져옴
      const roomPlayers = Array.from(room.players.values());
      
      // 2. 랜덤으로 선공(흑돌) 플레이어 선택
      const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;
      const secondPlayerIndex = firstPlayerIndex === 0 ? 1 : 0;

      // 3. 선공은 'black', 후공은 'white'로 색상 재배정
      roomPlayers[firstPlayerIndex].color = 'black';
      roomPlayers[secondPlayerIndex].color = 'white';

      // 4. Map 데이터도 갱신된 색상으로 업데이트
      room.players.set(roomPlayers[firstPlayerIndex].email, roomPlayers[firstPlayerIndex]);
      room.players.set(roomPlayers[secondPlayerIndex].email, roomPlayers[secondPlayerIndex]);

      // 5. 현재 턴을 흑돌(선공)의 색상으로 설정
      room.currentTurn = 'black';

      // 게임 시작 이벤트 발송
      io.to(roomId).emit('game:start', { 
        roomId,
        turn: room.currentTurn, // 항상 'black' (흑돌 선공)
        turnCount: room.turnCount,
        board: room.board,
        players: Array.from(room.players.values()) 
      });

      if (room.turnCount === 1) {
        // 클라이언트 화면 전환 시간을 고려해 0.5초 후 증강 선택지 발송
        setTimeout(() => {
          room.triggerAugmentSelection(io);
        }, 500);
      }
    }
  });

  // 방 나가기(뒤로가기) 핸들러도 확인/추가
  socket.on('room:leave', async ({ roomId }) => {
    socket.leave(roomId);
    gameRoomManager.leaveRoom(roomId, userEmail || socket.id);
    // 남은 사람들에게 인원 변경 알림
    const room = gameRoomManager.getRoom(roomId);
    if (room) {
      io.to(roomId).emit('room:update', { players: Array.from(room.players.values()) });
      
      const updatedRoom = {
        roomId: room.roomId,
        roomTitle: room.roomTitle,
        playerCount: room.players.size,
        status: room.status
      };
      await redisSessionManager.saveRoom(roomId, updatedRoom);
    } else {
      // 남은 사람이 없어 방이 삭제된 경우 Redis에서도 제거
      await redisSessionManager.deleteRoom(roomId);
    }

    // 로비에 있는 유저들에게 방 목록 갱신 전송
    const roomsData = await redisSessionManager.getAllRooms();
    const roomList: SCRoomSummary[] = roomsData
      .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
      .filter((r) => r.status !== 'finished');
    io.emit('room:list', roomList);
  });

  //방 정보 동기화 요청 
  socket.on('room:get', ({ roomId }: { roomId: string }) => {
    try {
      const roomInstance = gameRoomManager.getRoom(roomId);
      
      // 방이 존재하지 않거나 플레이어 정보가 비어있는 경우
      if (!roomInstance || roomInstance.players.size === 0) {
        socket.emit('room:not_found', { message: '존재하지 않거나 삭제된 방입니다.' });
        return;
      }

      if (userEmail && userNickname) {
        // 새로고침으로 인해 바뀐 새로운 socket.id로 유저 정보를 갱신
        roomInstance.addPlayer(userId, userEmail, userNickname, socket.id);
        socket.join(roomId);

        // 방 전체에 갱신된 플레이어 목록 브로드캐스트
        io.to(roomId).emit('room:update', { 
          players: Array.from(roomInstance.players.values()) 
        });
        console.log(`[Room] ${userNickname} 님의 재접속(새로고침)으로 방(${roomId}) 소켓 ID를 갱신하고 동기화했습니다.`);
      }
    } catch (err) {
      console.error('방 정보 조회 오류:', err);
    }
  });

  // 보드 상태 동기화 요청 
  socket.on('game:sync', ({ roomId }: { roomId: string }) => {
    try {
      const room = gameRoomManager.getRoom(roomId);
      if (!room) return;

      // 새로고침이나 화면 전환 시 소켓 ID 갱신
      if (userEmail && userNickname) {
        room.addPlayer(userId, userEmail, userNickname, socket.id);
        socket.join(roomId);
      }

      socket.emit('game:sync:response', {
        roomId: room.roomId,
        status: room.status,
        turn: room.currentTurn,
        turnCount: room.turnCount,
        board: room.board,
        players: Array.from(room.players.values())
      });
      console.log(`[GameSync] ${userNickname} 님의 게임 상태 동기화 완료 (방 ID: ${roomId})`);
    } catch (err) {
      console.error('game:sync 처리 에러:', err);
    }
  });

  // 착수 요청 이벤트 핸들러
  socket.on('game:put_stone', async ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
    try {
      if (!userEmail) {
        socket.emit('game:error', { message: '인증되지 않은 사용자입니다.' });
        return;
      }

      const room = gameRoomManager.getRoom(roomId);
      if (!room) {
        socket.emit('game:error', { message: '존재하지 않는 방입니다.' });
        return;
      }

      // 서버 게임룸의 착수 검증 및 보드 업데이트 실행
      const result = room.putStone(userEmail, x, y);

      if (!result.success) {
        // 유효하지 않은 착수 시 요청한 클라이언트에게만 에러 통보
        socket.emit('game:error', { message: result.message });
        return;
      }

      // 착수 성공 시 방 전체 플레이어에게 게임 상태 브로드캐스트
      io.to(roomId).emit('game:update', {
        x,
        y,
        color: result.color,
        currentTurn: room.currentTurn,
        turnCount: room.turnCount,
        board: room.board,
        players: Array.from(room.players.values())
      });

      // 승리 조건이 달성된 경우 게임 종료 이벤트 발송
      if (result.isWin) {
        const winner = Array.from(room.players.values()).find(p => p.color === result.color);
        const loser = Array.from(room.players.values()).find(p => p.color !== result.color);

        // Redis에 방 상태를 'finished'로 갱신하여 저장
        const updatedRoom = {
          roomId: room.roomId,
          roomTitle: room.roomTitle,
          playerCount: room.players.size,
          status: 'finished'
        };
        await redisSessionManager.saveRoom(roomId, updatedRoom);

        // 클라이언트에 결과 화면 출력 명령
        io.to(roomId).emit('game:over', {
          winner: result.color,
          winnerNickname: winner?.nickname || '알 수 없음',
          message: `${winner?.nickname || result.color} 님이 5목을 완성하여 승리했습니다!`
        });

        //DB 관련 작업 
        try {
          const blackPlayer = Array.from(room.players.values()).find(p => p.color === 'black');
          const whitePlayer = Array.from(room.players.values()).find(p => p.color === 'white');
          const winner = Array.from(room.players.values()).find(p => p.color === result.color);
          const loser = Array.from(room.players.values()).find(p => p.color !== result.color);

          if (blackPlayer && whitePlayer && winner) {
            // 대국 기록 저장
            await gameRecordRepositoryImpl.saveGameRecord({
              blackUserId: blackPlayer.userId,
              whiteUserId: whitePlayer.userId,
              winnerUserId: winner.userId,
              boardState: room.board,
              endReason: "WIN",
              totalTurn: room.turnCount
            });

            // 승자 전적 반영
            await userStateRepositoryImpl.applyGameResult(winner.userId, 'win', 10);

            // 패자 전적 반영
            if (loser) {
              await userStateRepositoryImpl.applyGameResult(loser.userId, 'lose', -10);
            }
            console.log(`[전적 및 대국 기록 저장 완료] 승자: ${winner?.nickname}, 패자: ${loser?.nickname}`);
          }
        } catch (err) {
          console.error('대국 기록 또는 전적 반영 중 오류:', err);
        }

        // 로비에 있는 전체 유저들에게 종료된 방이 제외된 목록 전송
        const roomsData = await redisSessionManager.getAllRooms();
        const roomList = roomsData
          .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
          .filter((r) => r.status !== 'finished');
        
        io.emit('room:list', roomList);
      }
      else if ((room.turnCount === 15 || room.turnCount === 30)) {
        //승리하지 않았고 15턴 혹은 30턴이 된 경우 
        room.triggerAugmentSelection(io);
      }

    } catch (err) {
      console.error('착수 처리 중 오류:', err);
      socket.emit('game:error', { message: '착수 처리 중 서버 오류가 발생했습니다.' });
    }
  });
  
  // 증강 선택 수신 이벤트 핸들러 추가
  socket.on('game:augment:choose', async ({ roomId, augmentId }: { roomId: string; augmentId: string }) => {
    try {
      const room = gameRoomManager.getRoom(roomId);
      if (!room || !userEmail) return;

      const player = room.players.get(userEmail);
      if (player) {
        // 클라이언트가 보낸 ID로 전체 증강 객체 데이터 조회
        const augmentData = AUGMENT_MAP.get(augmentId);
        // 중복 획득 방지 후 전체 객체 상태로 추가
        if (augmentData && !player.augments.some((a) => a.id === augmentId)) {
          player.augments.push(augmentData);
        }

        // 대기 명단에서 제외
        room.pendingAugmentPlayers.delete(userEmail);
        console.log(`[Augment] ${player.nickname} 증강 획득: ${augmentId}`);
      }

      // 방의 모든 플레이어가 선택을 마쳤는지 확인
      if (room.pendingAugmentPlayers.size === 0) {
        // 선택 완료된 상태를 방 전체에 동기화
        io.to(roomId).emit('game:update', {
          currentTurn: room.currentTurn,
          turnCount: room.turnCount,
          board: room.board,
          players: Array.from(room.players.values())
        });
        console.log(`[Augment] 방(${roomId}) 모든 인원 증강 선택 완료. 게임 진행 동기화.`);
      }
    } catch (err) {
      console.error('증강 선택 처리 중 오류:', err);
    }
  });

  //항복 요청 처리 
  socket.on('game:surrender', async ({ roomId }) => {
    try {
      if (!userEmail) return;

      const room = gameRoomManager.getRoom(roomId);
      if (!room || room.status !== 'playing') return;

      room.status = 'finished';

      const loser = room.players.get(userEmail);
      const winner = Array.from(room.players.values()).find(p => p.email !== userEmail);

      // Redis 방 상태를 'finished'로 갱신
      const updatedRoom = {
        roomId: room.roomId,
        roomTitle: room.roomTitle,
        playerCount: room.players.size,
        status: 'finished'
      };
      await redisSessionManager.saveRoom(roomId, updatedRoom);

      // 방 전체에 항복으로 인한 게임 종료 브로드캐스트
      io.to(roomId).emit('game:over', {
        winner: winner?.color || 'black',
        winnerNickname: winner?.nickname || '상대방',
        message: `${loser?.nickname || '플레이어'} 님의 항복으로 승리했습니다!`
      });

      // DB 대국 기록 및 전적 반영
      try {
        const blackPlayer = Array.from(room.players.values()).find(p => p.color === 'black');
        const whitePlayer = Array.from(room.players.values()).find(p => p.color === 'white');

        if (blackPlayer && whitePlayer && winner) {
          await gameRecordRepositoryImpl.saveGameRecord({
            blackUserId: blackPlayer.userId,
            whiteUserId: whitePlayer.userId,
            winnerUserId: winner.userId,
            boardState: room.board,
            endReason: "SURRENDER",
            totalTurn: room.turnCount
          });

          await userStateRepositoryImpl.applyGameResult(winner.userId, 'win', 10);
          if (loser) {
            await userStateRepositoryImpl.applyGameResult(loser.userId, 'lose', -10);
          }
          console.log(`[항복 전적 반영 완료] 승자: ${winner.nickname}, 패자: ${loser?.nickname}`);
        }
      } catch (err) {
        console.error('항복 대국 기록 또는 전적 반영 중 오류:', err);
      }

      // 로비 방 목록 갱신
      const roomsData = await redisSessionManager.getAllRooms();
      const roomList = roomsData
        .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
        .filter((r) => r.status !== 'finished');
      
      io.emit('room:list', roomList);

    } catch (err) {
      console.error('항복 처리 중 오류:', err);
    }
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