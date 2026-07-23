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
import { s3Service } from './services/s3Service';
import activeConfig from './config/configLoader';
import { userStateRepositoryImpl } from './repositories/mysqlUserStateRepository';
import gameRecordRoutes from "./routes/gameRecordRoutes";
import { gameRecordRepositoryImpl } from "./repositories/mysqlGameRecordRepository";
import { AUGMENT_MAP } from './shared/data/augments';
import { userRepository, userStateRepository } from './repositories';

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

// 게임 상태를 방 내 플레이어들에게 조건에 맞춰 전송하는 헬퍼 함수
function broadcastGameUpdate(io: Server, room: any, extraData: object = {}) {
  const playersArray = Array.from(room.players.values()) as any[];
  // 플레이어 중 한 명이라도 activeEffects가 존재하는지 확인
  const hasActiveEffects = playersArray.some(p => p.activeEffects && p.activeEffects.length > 0);
  const hasHiddenStones = room.hiddenStones && room.hiddenStones.length > 0;

  if (hasActiveEffects || hasHiddenStones) {
    // 상태이상(특수 효과)이 있는 경우: 각 플레이어마다 맞춤형으로 개별 전송
    for (const player of playersArray) {
      // 1. 원본 보드를 복사
      const personalizedBoard = room.board.map((row: any) => [...row]);

      // [전장의 안개] 효과 적용
      const hasFog = player.activeEffects?.some((e: any) => e.id === 'fog_of_war');
      if (hasFog) {
        const myColor = player.color;
        // 시야 확보 여부를 체크할 마스크 배열
        const visibleMask = Array(15).fill(null).map(() => Array(15).fill(false));
        const directions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]; // 내 돌과 상하좌우 4방향

        // 내 돌을 찾아 시야 마스크 활성화
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (room.board[y][x] === myColor) {
              for (const [dy, dx] of directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < 15 && nx >= 0 && nx < 15) {
                  visibleMask[ny][nx] = true;
                }
              }
            }
          }
        }

        // 시야가 닿지 않는 곳을 fog 처리
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (!visibleMask[y][x]) {
              personalizedBoard[y][x] = 'fog'; // 클라이언트에서 이 문자열을 받아 안개 그래픽 렌더링
            }
          }
        }
      }

      // [숨겨진 돌] 처리
      if (hasHiddenStones) {
        for (const hiddenStone of room.hiddenStones) {
          if (hiddenStone.email !== player.email) {
            // 전장의 안개로 이미 가려진 칸은 덮어쓸 필요 없음
            if (personalizedBoard[hiddenStone.y][hiddenStone.x] !== 'fog') {
              personalizedBoard[hiddenStone.y][hiddenStone.x] = '';
            }
          }
        }
      }

      // 본인의 숨겨진 돌 위치를 클라이언트에 전달하기 위한 배열
      const myHiddenStones = room.hiddenStones
        ? room.hiddenStones.filter((s: any) => s.email === player.email)
        : [];

      io.to(player.socketId).emit('game:update', {
        currentTurn: room.currentTurn,
        turnCount: room.turnCount,
        board: personalizedBoard,
        players: playersArray,
        sealedCells: room.sealedCells,
        myHiddenStones,
        lastMoves: room.lastMoves,
        ...extraData
      });
    }
  } else {
    // 상태이상이 없는 경우: 기존처럼 방 전체에 일괄 브로드캐스트
    io.to(room.roomId).emit('game:update', {
      currentTurn: room.currentTurn,
      turnCount: room.turnCount,
      board: room.board,
      players: playersArray,
      sealedCells: room.sealedCells,
      lastMoves: room.lastMoves,
      ...extraData
    });
  }
}

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

  // Helper: fetch latest session for this socket (nickname/profileImage), update socket.user
  const fetchLatestSession = async () => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== 'string') {
        return {
          nickname: socket.user?.nickname ?? userNickname ?? '',
          profileImage: socket.user?.profileImage ?? null,
        };
      }

      // 1) 먼저 Redis에 저장된 세션을 확인
      const session = await redisSessionManager.getSession(String(token));

      // 2) DB에서 최신 유저 정보를 가져옴
      let dbUser = null;
      try {
        dbUser = await userRepository.findById(userId);
      } catch (err) {
        console.warn('DB 사용자 조회 실패:', (err as any)?.message ?? err);
      }

      // 3) DB에서 얻은 profileImage 키를 presigned URL로 변환(항상 우선)
      let signedProfile: string | null = null;
      try {
        const profileKey = dbUser?.profileImage ?? session?.profileImage ?? socket.user?.profileImage ?? null;
        signedProfile = await s3Service.getProfilePresignedGetUrl(profileKey ?? null);
      } catch (err) {
        console.warn('프로필 presign 변환 실패:', (err as any)?.message ?? err);
      }

      // 최신 nickname: DB 우선, 없으면 세션
      const latestNickname = dbUser?.nickname ?? session?.nickname ?? socket.user?.nickname ?? userNickname ?? '';

      // 4) Redis 세션을 최신화하여 nickname/profileImage를 보장
      try {
        await redisSessionManager.updateSession(String(token), {
          nickname: latestNickname,
          profileImage: signedProfile,
        });
      } catch (err) {
        console.warn('세션 업데이트 실패:', (err as any)?.message ?? err);
      }

      // 5) socket.user 업데이트
      socket.user = {
        userId: session?.userId ?? socket.user?.userId,
        email: session?.email ?? socket.user?.email,
        nickname: latestNickname,
        profileImage: signedProfile ?? socket.user?.profileImage ?? null,
      } as any;

      return {
        nickname: latestNickname,
        profileImage: signedProfile ?? socket.user?.profileImage ?? null,
      };
    } catch (err) {
      return {
        nickname: socket.user?.nickname ?? userNickname ?? '',
        profileImage: socket.user?.profileImage ?? null,
      };
    }
  };
  
  // 새로고침 등으로 5초 이내에 재연결된 경우 타이머 취소
  if (userEmail && disconnectTimerManager.has(userEmail)) {
    disconnectTimerManager.clear(userEmail);
    console.log(`[세션 유지] ${userNickname}(${userEmail}) 님 재연결 감지 (삭제 예약 취소)`);
  }

  // 재접속 시 방에 참여 중인지 확인하고 클라이언트에게 재연결 이벤트 전송 추가
  if (userEmail) {
    const allRooms = gameRoomManager.getAllRooms();
    for (const room of allRooms) {
      const player = Array.from(room.players.values()).find(p => p.email === userEmail);
      if (player) {
        player.socketId = socket.id;
        socket.join(room.roomId);

        socket.emit('room:reconnect', {
          roomId: room.roomId,
          roomTitle: room.roomTitle,
          status: room.status
        });
        break;
      }
    }
  }

  // 접속이 끊겼을 때
  socket.on('disconnect', async () => {
    console.log(`[Server] 유저 ${userNickname} 님의 접속이 끊겼습니다. (소켓 ID: ${socket.id})`);

    if (!userEmail) return;

    // 즉시 방에서 퇴장시키지 않고 5초의 유예 시간(타이머) 안에 처리
    const timer = setTimeout(async () => {
      try {
        // 1. 방 퇴장 및 몰수패 처리 (5초 동안 재연결되지 않은 경우)
        const allRooms = gameRoomManager.getAllRooms();
        for (const room of allRooms) {
          const player = Array.from(room.players.values()).find(p => p.email === userEmail);

          if (player) {
            console.log(`[Room] 5초 경과로 인한 방(${room.roomId}) 자동 퇴장 처리: ${player.nickname}`);

            // 게임 중이었다면 남은 유저 승리 처리 (유령 방 및 갇힘 방지)
            if (room.status === 'playing') {
              room.status = 'finished';
              const winner = Array.from(room.players.values()).find(p => p.email !== userEmail);
              
              if (winner) {
                io.to(room.roomId).emit('game:system_message', {
                  message: `상대방의 연결이 끊어졌습니다.`
                });
                io.to(room.roomId).emit('game:over', {
                  winner: winner.color,
                  winnerNickname: winner.nickname,
                  message: `${player.nickname} 님의 연결 종료(도망)로 승리했습니다!`
                });

                try {
                  await userStateRepositoryImpl.applyGameResult(winner.userId, 'win', 10);
                  await userStateRepositoryImpl.applyGameResult(player.userId, 'lose', -10);
                } catch (err) {
                  console.error('몰수패 전적 반영 에러:', err);
                }
              }
            }

            // 방에서 플레이어 제거
            gameRoomManager.leaveRoom(room.roomId, player.socketId);

            // 남은 사람들에게 업데이트 알림 또는 방 폭파
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
              await redisSessionManager.deleteRoom(room.roomId);
            }

            // 로비 방 목록 갱신
            const roomsData = await redisSessionManager.getAllRooms();
            const roomList = roomsData
              .map((roomStr: string) => JSON.parse(roomStr) as SCRoomSummary)
              .filter((r) => r.status !== 'finished');
            io.emit('room:list', roomList);
            break;
          }
        }

        // 2. 세션 파기
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
    if (userEmail) {
      console.log('서버: 방 생성 성공 이벤트 발송 테스트', roomId);
      try {
        const latest = await fetchLatestSession();
        roomInstance.addPlayer(userId, userEmail, (latest.nickname ?? userEmail ?? ''), socket.id, latest.profileImage ?? null);
      } catch (err) {
        roomInstance.addPlayer(userId, userEmail, (socket.user?.nickname ?? userNickname ?? userEmail ?? ''), socket.id, socket.user?.profileImage ?? null);
      }

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
    {
      const playersForLog = Array.from(roomInstance.players.values()).map((p: any) => ({ email: p.email, nickname: p.nickname, hasProfileImage: Boolean(p.profileImage) }));
      console.debug('[room:update] players:', playersForLog);
    }
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
      // 최신 세션을 다시 조회하여 nickname/profileImage를 재확인
      let success = false;
      try {
        const latest = await fetchLatestSession();
        success = roomInstance.addPlayer(userId, userEmail, (latest.nickname ?? userEmail ?? ''), socket.id, latest.profileImage ?? null);
      } catch (err) {
        success = roomInstance.addPlayer(userId, userEmail, (socket.user?.nickname ?? userNickname ?? userEmail ?? ''), socket.id, socket.user?.profileImage ?? null);
      }
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
      {
        const playersForLog = Array.from(roomInstance.players.values()).map((p: any) => ({ email: p.email, nickname: p.nickname, hasProfileImage: Boolean(p.profileImage) }));
        console.debug('[room:update] players:', playersForLog);
      }
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
    {
      const playersForLog = Array.from(room.players.values()).map((p: any) => ({ email: p.email, nickname: p.nickname, hasProfileImage: Boolean(p.profileImage) }));
      console.debug('[room:update] players:', playersForLog);
    }
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
        players: Array.from(room.players.values()),
        sealedCells: room.sealedCells,
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
      const playersForLog = Array.from(room.players.values()).map((p: any) => ({ email: p.email, nickname: p.nickname, hasProfileImage: Boolean(p.profileImage) }));
      console.debug('[room:update] players:', playersForLog);
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
  socket.on('room:get', async ({ roomId }: { roomId: string }) => {
    try {
      const roomInstance = gameRoomManager.getRoom(roomId);

      // 방이 존재하지 않거나 플레이어 정보가 비어있는 경우
      if (!roomInstance || roomInstance.players.size === 0) {
        socket.emit('room:not_found', { message: '존재하지 않거나 삭제된 방입니다.' });
        return;
      }

      if (userEmail) {
        // 새로고침으로 인해 바뀐 새로운 socket.id로 유저 정보를 갱신 (최신 세션 사용)
        try {
          const latest = await fetchLatestSession();
          roomInstance.addPlayer(userId, userEmail, (latest.nickname ?? userEmail ?? ''), socket.id, latest.profileImage ?? null);
        } catch (err) {
          roomInstance.addPlayer(userId, userEmail, (socket.user?.nickname ?? userNickname ?? userEmail ?? ''), socket.id, socket.user?.profileImage ?? null);
        }
        socket.join(roomId);

        // 방 전체에 갱신된 플레이어 목록 브로드캐스트
        io.to(roomId).emit('room:update', {
          players: Array.from(roomInstance.players.values())
        });
        console.log(`[Room] ${socket.user?.nickname ?? userNickname} 님의 재접속(새로고침)으로 방(${roomId}) 소켓 ID를 갱신하고 동기화했습니다.`);
      }
    } catch (err) {
      console.error('방 정보 조회 오류:', err);
    }
  });

  // 보드 상태 동기화 요청 
  socket.on('game:sync', async ({ roomId }: { roomId: string }) => {
    try {
      const room = gameRoomManager.getRoom(roomId);
      if (!room) return;

      // 새로고침이나 화면 전환 시 소켓 ID 갱신 (최신 세션 사용)
      if (userEmail) {
        try {
          const latest = await fetchLatestSession();
          room.addPlayer(userId, userEmail, (latest.nickname ?? userEmail ?? ''), socket.id, latest.profileImage ?? null);
        } catch (err) {
          room.addPlayer(userId, userEmail, (socket.user?.nickname ?? userNickname ?? userEmail ?? ''), socket.id, socket.user?.profileImage ?? null);
        }
        socket.join(roomId);
      }

      {
        const playersForLog = Array.from(room.players.values()).map((p: any) => ({ email: p.email, nickname: p.nickname, hasProfileImage: Boolean(p.profileImage) }));
        console.debug('[game:sync:response] players:', playersForLog);
      }
      socket.emit('game:sync:response', {
        roomId: room.roomId,
        status: room.status,
        turn: room.currentTurn,
        turnCount: room.turnCount,
        board: room.board,
        players: Array.from(room.players.values()),
        sealedCells: room.sealedCells,
      });

      if (userEmail && room.pendingAugmentPlayers.has(userEmail)) {
        const options = room.pendingAugmentOptions.get(userEmail);
        if (options) {
          socket.emit('game:augment:select', { options });
        }
      }

      console.log(`[GameSync] ${socket.user?.nickname ?? userNickname} 님의 게임 상태 동기화 완료 (방 ID: ${roomId})`);
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

      if (result.hiddenMoveCrushed) {
          io.to(roomId).emit('game:system_message', { 
            message: `💥 쨍그랑! 상대의 숨겨진 돌을 파괴했습니다! 💥` 
          });
      }

      // 착수 성공 시 방 전체 플레이어에게 게임 상태 브로드캐스트
      broadcastGameUpdate(io, room, { x, y, color: result.color });
      // io.to(roomId).emit('game:update', {
      //   x,
      //   y,
      //   color: result.color,
      //   currentTurn: room.currentTurn,
      //   turnCount: room.turnCount,
      //   board: room.board,
      //   players: Array.from(room.players.values())
      // });

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
              roomTitle: room.roomTitle,
              blackUserId: blackPlayer.userId,
              whiteUserId: whitePlayer.userId,
              winnerUserId: winner.userId,
              boardState: room.board,
              endReason: "WIN",
              totalTurn: room.turnCount,
              selectedAugment: {
                black: blackPlayer.augments.map((a) => a.id),
                white: whitePlayer.augments.map((a) => a.id)
              }
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
          player.augments.push({ // 얕은 복사 실시 
            ...augmentData,
            isUsed: false // 초기 사용 여부 설정
          });
        }

        // 대기 명단에서 제외
        room.pendingAugmentPlayers.delete(userEmail);
        console.log(`[Augment] ${player.nickname} 증강 획득: ${augmentId}`);
      }

      // 방의 모든 플레이어가 선택을 마쳤는지 확인
      if (room.pendingAugmentPlayers.size === 0) {
        // 선택 완료된 상태를 방 전체에 동기화
        broadcastGameUpdate(io, room)
        // io.to(roomId).emit('game:update', {
        //   currentTurn: room.currentTurn,
        //   turnCount: room.turnCount,
        //   board: room.board,
        //   players: Array.from(room.players.values())
        // });
        console.log(`[Augment] 방(${roomId}) 모든 인원 증강 선택 완료. 게임 진행 동기화.`);
      }
    } catch (err) {
      console.error('증강 선택 처리 중 오류:', err);
    }
  });

  socket.on('game:augment:use', async ({ roomId, augmentId, target }: { roomId: string; augmentId: string; target?: { x: number; y: number } }) => {
    try {
      if (!userEmail) {
        socket.emit('game:error', { message: '인증되지 않은 사용자입니다.' });
        return;
      }

      const room = gameRoomManager.getRoom(roomId);
      if (!room || room.status !== 'playing') {
        socket.emit('game:error', { message: '진행 중인 게임이 아닙니다.' });
        return;
      }

      const player = room.players.get(userEmail);
      if (!player) {
        socket.emit('game:error', { message: '방에 참여한 플레이어가 아닙니다.' });
        return;
      }

      if (player.color !== room.currentTurn) {
        socket.emit('game:error', { message: '현재 본인의 차례가 아닙니다.' });
        return;
      }

      // 플레이어가 실제로 해당 증강을 보유하고 있는지 확인
      const augmentIndex = player.augments.findIndex((a) => a.id === augmentId);
      if (augmentIndex === -1) {
        socket.emit('game:error', { message: '보유하지 않은 증강입니다.' });
        return;
      }

      const augmentData = AUGMENT_MAP.get(augmentId);
      if (!augmentData) {
        socket.emit('game:error', { message: '존재하지 않는 증강 정보입니다.' });
        return;
      }

      // TARGET_SELECT 타입인데 대상 좌표가 안 넘어온 경우 예외 처리
      if (augmentData.type === 'TARGET_SELECT' && (!target || target.x === undefined || target.y === undefined)) {
        socket.emit('game:error', { message: '증강을 사용할 대상 위치를 지정해야 합니다.' });
        return;
      }

      console.log(`[Augment Use] ${player.nickname} 님이 증강 사용: ${augmentData.name} (대상:`, target, `)`);

      // 증강 효과 세부 처리 분기
      if (augmentId === 'sniper' && target) {
        // 저격: 상대 돌 1개 선택해 제거
        const targetStoneColor = target.x >= 0 && target.x <= 14 && target.y >= 0 && target.y <= 14 ? room.board[target.y][target.x] : '';
        const opponentColor = player.color === 'black' ? 'white' : 'black';

        if (targetStoneColor !== opponentColor) {
          socket.emit('game:error', { message: '제거할 수 없는 위치이거나 상대방의 돌이 아닙니다.' });
          return;
        }
        room.board[target.y][target.x] = ''; // 돌 제거
      } 
      else if (augmentId === 'seal_empty' && target) {
        // 빈칸 봉인
        const cellVal = room.board[target.y]?.[target.x];
        if (cellVal !== '') {
          socket.emit('game:error', { message: '빈칸에만 봉인을 사용할 수 있습니다.' });
          return;
        }
        // 봉인 상태를 보드나 방 정보에 기록
        const alreadySealed = room.sealedCells.some((cell: any) => cell.x === target.x && cell.y === target.y);
        if (alreadySealed) {
          socket.emit('game:error', { message: '이미 봉인된 칸입니다.' });
          return;
        }
      
        // 2턴 동안 유지되도록 배열에 밀어넣기
        room.sealedCells.push({ x: target.x, y: target.y, turnsRemaining: 2 });
        console.log(`[Seal Empty] ${player.nickname} 님이 (${target.x}, ${target.y}) 칸을 2턴간 봉인했습니다.`);
      }
      else if (augmentId === 'coin_flip' ) {
        // 자신의 돌 하나를 랜덤한 위치로 이동시킵니다.
        const myColor = player.color;
        const myStones: { x: number; y: number }[] = [];
        const emptyCells: { x: number; y: number }[] = [];

        // 1. 보드 전체를 돌며 내 돌 좌표와 빈칸 좌표 수집
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (room.board[y][x] === myColor) {
              myStones.push({ x, y });
            } else if (room.board[y][x] === '') {
              emptyCells.push({ x, y });
            }
          }
        }

        if (myStones.length === 0) {
          socket.emit('game:error', { message: '이동시킬 내 돌이 없습니다.' });
          return;
        }

        if (emptyCells.length === 0) {
          socket.emit('game:error', { message: '이동할 빈칸이 없습니다.' });
          return;
        }

        // 2. 무작위로 내 돌 하나 선택
        const randomStone = myStones[Math.floor(Math.random() * myStones.length)];
        // 3. 무작위로 빈칸 하나 선택
        const randomEmpty = emptyCells[Math.floor(Math.random() * emptyCells.length)];

        // 4. 돌 이동 처리
        room.board[randomStone.y][randomStone.x] = '';
        room.board[randomEmpty.y][randomEmpty.x] = myColor;

        console.log(`[Coin Flip] ${player.nickname} 님의 돌 이동: (${randomStone.x}, ${randomStone.y}) -> (${randomEmpty.x}, ${randomEmpty.y})`);
      }
      else if (augmentId === 'double_coin') {
        // 랜덤한 상대 돌과 랜덤한 자신의 돌 위치를 바꿉니다.
        const myColor = player.color;
        const opponentColor = myColor === 'black' ? 'white' : 'black';
        
        const myStones: { x: number; y: number }[] = [];
        const opponentStones: { x: number; y: number }[] = [];

        // 1. 보드 전체를 돌며 내 돌과 상대 돌 좌표 수집
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (room.board[y][x] === myColor) {
              myStones.push({ x, y });
            } else if (room.board[y][x] === opponentColor) {
              opponentStones.push({ x, y });
            }
          }
        }

        if (myStones.length === 0) {
          socket.emit('game:error', { message: '위치를 바꿀 내 돌이 없습니다.' });
          return;
        }

        if (opponentStones.length === 0) {
          socket.emit('game:error', { message: '위치를 바꿀 상대의 돌이 없습니다.' });
          return;
        }

        // 2. 내 돌과 상대 돌 중 하나씩 무작위 선택
        const randomMyStone = myStones[Math.floor(Math.random() * myStones.length)];
        const randomOppStone = opponentStones[Math.floor(Math.random() * opponentStones.length)];

        // 3. 두 돌의 위치 스왑(교체) 처리
        room.board[randomMyStone.y][randomMyStone.x] = opponentColor;
        room.board[randomOppStone.y][randomOppStone.x] = myColor;

        console.log(`[Double Coin] ${player.nickname} 님의 돌 교체: 내 돌(${randomMyStone.x}, ${randomMyStone.y}) <-> 상대 돌(${randomOppStone.x}, ${randomOppStone.y})`);
      }
      else if (augmentId === 'chaos_party') {
        // 3턴 동안 모든 돌의 색을 변화시킵니다.
        for (const p of room.players.values()) {
          // 중복 적용 방지
          if (!p.activeEffects.some(e => e.id === 'chaos_party')) {
            p.activeEffects.push({
              id: 'chaos_party',
              turnsRemaining: 3
            });
          }
          else {
            const existingEffect = p.activeEffects.find(e => e.id === 'chaos_party');
            if (existingEffect) {
              existingEffect.turnsRemaining = 3; // 이미 있으면 턴 수 초기화
            }
          }
        }

        console.log(`[Chaos Party] ${player.nickname} 님이 대환장 파티(3턴 지속) 효과를 발동했습니다.`);
      }
      else if (augmentId === 'hidden_move') {
        // 이번 턴에 둔 돌이 1턴 동안 상대에게 안 보입니다.
        player.activeEffects.push({
            id: 'hidden_move_pending',
            turnsRemaining: 3
        });
        console.log(`[Hidden Move] ${player.nickname} 님이 숨겨진 한 수 대기 상태가 되었습니다.`);
      }
      else if (augmentId === 'fog_of_war') {
        // 3턴 동안 상대가 자신의 돌과 인접한 칸만 보이도록 합니다.
        const opponent = Array.from(room.players.values()).find(p => p.email !== userEmail);
        
        if (opponent) {
          const existingEffect = opponent.activeEffects.find(e => e.id === 'fog_of_war');
          if (existingEffect) {
            existingEffect.turnsRemaining = 3;
          } else {
            opponent.activeEffects.push({
              id: 'fog_of_war',
              turnsRemaining: 3
            });
          }
          console.log(`[Fog of War] ${player.nickname} 님이 ${opponent.nickname} 님에게 전장의 안개(3턴 지속) 효과를 적용했습니다.`);
        }
      }
      else if (augmentId === 'mixer' && target) {
        // 3x3 칸 내의 바둑알을 무작위로 섞습니다.
        const minX = Math.max(0, target.x - 1);
        const maxX = Math.min(14, target.x + 1);
        const minY = Math.max(0, target.y - 1);
        const maxY = Math.min(14, target.y + 1);

        const cells: { x: number; y: number }[] = [];
        const stones: string[] = [];

        // 1. 3x3 범위 내의 좌표와 들어있는 돌(또는 빈칸) 수집
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            cells.push({ x, y });
            stones.push(room.board[y][x]);
          }
        }

        // 2. 수집한 돌들을 무작위로 섞기 (Fisher-Yates Shuffle)
        for (let i = stones.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [stones[i], stones[j]] = [stones[j], stones[i]];
        }

        // 3. 섞인 돌들을 다시 해당 칸들에 배치
        for (let i = 0; i < cells.length; i++) {
          const { x, y } = cells[i];
          room.board[y][x] = stones[i];
        }

        console.log(`[Mixer] ${player.nickname} 님이 (${target.x}, ${target.y}) 중심 3x3 영역의 돌들을 무작위로 섞었습니다.`);
      }
      else if (augmentId === 'meteor' && target) {
        // 3x3 칸 내의 모든 바둑알을 무작위 위치로 이동시킵니다
        // 3x3 칸 내의 모든 바둑알을 바둑판 전체의 무작위 위치로 이동시킵니다.
        const minX = Math.max(0, target.x - 1);
        const maxX = Math.min(14, target.x + 1);
        const minY = Math.max(0, target.y - 1);
        const maxY = Math.min(14, target.y + 1);

        const collectedStones: string[] = [];

        // 1. 3x3 범위 내의 돌들을 수집하고 해당 자리를 빈칸으로 만들기
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const stone = room.board[y][x];
            if (stone === 'black' || stone === 'white') {
              collectedStones.push(stone);
              room.board[y][x] = '';
            }
          }
        }

        if (collectedStones.length === 0) {
          socket.emit('game:error', { message: '3x3 범위 내에 이동시킬 돌이 없습니다.' });
          return;
        }

        // 2. 바둑판 전체에서 현재 비어 있는 모든 칸들의 좌표 수집
        const emptyCells: { x: number; y: number }[] = [];
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (room.board[y][x] === '') {
              emptyCells.push({ x, y });
            }
          }
        }

        // 만약 남은 빈칸이 수집한 돌보다 적다면 에러 처리 방지
        if (emptyCells.length < collectedStones.length) {
          socket.emit('game:error', { message: '이동시킬 빈 공간이 부족합니다.' });
          return;
        }

        // 3. 수집한 돌들을 무작위 빈칸에 각각 배치
        for (const stone of collectedStones) {
          const randomIndex = Math.floor(Math.random() * emptyCells.length);
          const targetCell = emptyCells.splice(randomIndex, 1)[0]; // 뽑은 칸은 목록에서 제거
          room.board[targetCell.y][targetCell.x] = stone;
        }

        console.log(`[Meteor] ${player.nickname} 님이 (${target.x}, ${target.y}) 중심 3x3 영역의 돌 ${collectedStones.length}개를 무작위 위치로 날려버렸습니다.`);
      }
      else if (augmentId === 'different_game') {
        // 자신의 돌로 둘러진 영역에 있는 상대 돌을 제거합니다.
        const myColor = player.color; 
        const oppColor = myColor === 'black' ? 'white' : 'black';

        // 방문 여부를 체크할 2차원 배열 초기화
        const visited = Array.from({ length: 15 }, () => Array(15).fill(false));
        const deadStones = [];
      
        // 상하좌우 방향 배열
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      
        // 전체 보드를 순회하며 상대방 돌 그룹의 숨구멍을 검사
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (room.board[y][x] === oppColor && !visited[y][x]) {
              const group = [];
              const queue = [{ cx: x, cy: y }];
              visited[y][x] = true;
              let hasLiberty = false;
            
              // BFS 탐색을 통해 상하좌우로 연결된 상대방 돌을 하나의 그룹으로 묶음
              let head = 0;
              while (head < queue.length) {
                const { cx, cy } = queue[head++];
                group.push({ x: cx, y: cy });
              
                for (const [dx, dy] of directions) {
                  const nx = cx + dx;
                  const ny = cy + dy;
                
                  // 보드판 범위 이내인지 확인
                  if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
                    const cell = room.board[ny][nx];

                    if (!cell || cell === '') {
                      // 빈칸이 하나라도 발견되면 이 그룹은 숨구멍이 있는 것으로 판정
                      hasLiberty = true;
                    } else if (cell === oppColor && !visited[ny][nx]) {
                      visited[ny][nx] = true;
                      queue.push({ cx: nx, cy: ny });
                    }
                  }
                }
              }
            
              // 탐색 종료 후 숨구멍이 단 하나도 없다면 사방이 막힌 그룹이므로 제거 배열에 추가
              if (!hasLiberty) {
                deadStones.push(...group);
              }
            }
          }
        }

        // 둘러싸인 상대방 돌들을 보드에서 일괄 제거
        let removedCount = 0;
        deadStones.forEach(stone => {
          room.board[stone.y][stone.x] = '';
          removedCount++;
        });
      }
      else if (augmentId === 'peek') {
        // 상대의 증강 1개를 확인합니다.
        const opponent = Array.from(room.players.values()).find(p => p.email !== userEmail);
        
        if (!opponent) {
          socket.emit('game:error', { message: '상대방 정보를 찾을 수 없습니다.' });
          return;
        }

        // 상대방의 증강 중 아직 사용하지 않은(isUsed가 false인) 증강들 필터링
        const unusedAugments = opponent.augments.filter(a => !a.isUsed);

        if (unusedAugments.length === 0) {
          socket.emit('game:error', { message: '상대방이 보유한 사용 가능한 증강이 없습니다.' });
          return;
        }

        // 남은 증강 중 무작위로 하나 선택
        const randomIndex = Math.floor(Math.random() * unusedAugments.length);
        const targetAugment = unusedAugments[randomIndex];

        // 얕은 복사를 통해 내 증강 배열에 추가하되, 사용할 수는 없도록 isUsed를 true로 설정
        const myPeekIndex = player.augments.findIndex(a => a.id === augmentId && !a.isUsed);
        if (myPeekIndex !== -1) {
          player.augments[myPeekIndex] = {
            ...targetAugment,
            isUsed: true // 사용 불가 상태로 표시만 함
          };
        }

        console.log(`[Peek] ${player.nickname} 님이 ${opponent.nickname} 님의 증강(${targetAugment.name})을 훔쳐봤습니다.`);

        if (opponent && opponent.socketId) {
          io.to(opponent.socketId).emit('game:augment:notified', {
            nickname: player.nickname,
            augmentName: augmentData.name,
            description: augmentData.description
          });
        }

        broadcastGameUpdate(io, room);
        return;
      }
      else if (augmentId === 'confiscate') {
        // 상대의 증강 1개를 사용 상태로 만듭니다.
        const opponent = Array.from(room.players.values()).find(p => p.email !== userEmail);
        
        if (!opponent) {
          socket.emit('game:error', { message: '상대방 정보를 찾을 수 없습니다.' });
          return;
        }

        // 상대방의 증강 중 아직 사용하지 않은 증강들 필터링
        const unusedAugments = opponent.augments.filter(a => !a.isUsed);

        if (unusedAugments.length === 0) {
          socket.emit('game:error', { message: '상대방이 보유한 사용 가능한 증강이 없습니다.' });
          return;
        }

        // 무작위로 증강 하나 선택
        const randomIndex = Math.floor(Math.random() * unusedAugments.length);
        const targetAugment = unusedAugments[randomIndex];

        // 선택된 상대방의 증강을 강제로 사용 완료(isUsed = true) 처리
        targetAugment.isUsed = true;

        console.log(`[Confiscate] ${player.nickname} 님이 ${opponent.nickname} 님의 증강(${targetAugment.name})을 압수(사용 불가 처리)했습니다.`);
      }
      else if (augmentId === 'steal') {
        // 상대 증강 1개를 대신 사용합니다.
        const opponent = Array.from(room.players.values()).find(p => p.email !== userEmail);
        
        if (!opponent) {
          socket.emit('game:error', { message: '상대방 정보를 찾을 수 없습니다.' });
          return;
        }

        // 상대방의 증강 중 아직 사용하지 않은 증강들 필터링
        const unusedAugments = opponent.augments.filter(a => !a.isUsed);

        if (unusedAugments.length === 0) {
          socket.emit('game:error', { message: '상대방이 보유한 사용 가능한 증강이 없습니다.' });
          return;
        }

        // 무작위로 증강 하나 선택
        const randomIndex = Math.floor(Math.random() * unusedAugments.length);
        const targetAugment = unusedAugments[randomIndex];

        // 1. 상대방의 원본 증강은 사용 불가 상태(압수)로 변경
        targetAugment.isUsed = true;

        // 2. 훔친 증강을 내 인벤토리에 적용
        const myStealIndex = player.augments.findIndex(a => a.id === augmentId && !a.isUsed);
        if (myStealIndex !== -1) {
          player.augments[myStealIndex] = {
            ...targetAugment,
            isUsed: false
          };
        }

        console.log(`[Steal] ${player.nickname} 님이 ${opponent.nickname} 님의 증강(${targetAugment.name})을 훔쳤습니다.`);

        if (opponent && opponent.socketId) {
          io.to(opponent.socketId).emit('game:augment:notified', {
            nickname: player.nickname,
            augmentName: augmentData.name,
            description: augmentData.description
          });
        }

        broadcastGameUpdate(io, room);
        return;
      }
      else if (augmentId === 'bombardment') {
        // 랜덤한 위치에 랜덤한 돌 5개를 둡니다.
        const emptySpots: { x: number, y: number }[] = [];
      
        // 1. 보드 전체를 순회하며 빈칸 좌표 수집
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            if (room.board[y][x] === '') {
              emptySpots.push({ x, y });
            }
          }
        }

        // 2. 빈칸이 5개 미만일 경우를 대비해 배치할 돌의 개수 확정
        const stonesToPlace = Math.min(5, emptySpots.length);
        if (stonesToPlace === 0) {
          socket.emit('game:error', { message: '보드에 빈칸이 없어 폭격을 사용할 수 없습니다.' });
          return;
        }

        // 3. 빈칸 배열을 무작위로 섞음 (Fisher-Yates 셔플 알고리즘)
        for (let i = emptySpots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = emptySpots[i];
          emptySpots[i] = emptySpots[j];
          emptySpots[j] = temp;
        }

        // 4. 무작위로 섞인 배열에서 앞에서부터 5개 선택
        const selectedSpots = emptySpots.slice(0, stonesToPlace);
        const colors: ('black' | 'white')[] = ['black', 'white'];

        // 5. 선택된 위치에 랜덤한 색상의 돌 배치
        selectedSpots.forEach(spot => {
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          room.board[spot.y][spot.x] = randomColor;
          console.log(`[Augment - Bombardment] (${spot.x}, ${spot.y}) 위치에 ${randomColor} 돌 배치`);
        });
      }
      else if (augmentId === 'table_flip') {
        // 모든 돌 위치를 랜덤한 위치로 이동시킵니다.
        const allStones: string[] = [];

        // 1. 보드 전체의 돌들을 수집하고 자리를 비우기
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            const stone = room.board[y][x];
            if (stone === 'black' || stone === 'white') {
              allStones.push(stone);
              room.board[y][x] = '';
            }
          }
        }

        if (allStones.length === 0) {
          socket.emit('game:error', { message: '이동시킬 돌이 판 위에 없습니다.' });
          return;
        }

        // 2. 바둑판 전체의 빈칸 좌표 목록 생성
        const emptyCells: { x: number; y: number }[] = [];
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < 15; x++) {
            emptyCells.push({ x, y });
          }
        }

        // 3. 수집한 돌들을 무작위 빈칸에 재배치
        for (const stone of allStones) {
          const randomIndex = Math.floor(Math.random() * emptyCells.length);
          const targetCell = emptyCells.splice(randomIndex, 1)[0];
          room.board[targetCell.y][targetCell.x] = stone;
        }

        console.log(`[Table Flip] ${player.nickname} 님이 판을 뒤엎어 모든 돌(${allStones.length}개)의 위치를 무작위로 섞었습니다.`);
      }
      else if (augmentId === 'undo') {
        // 이전 내 턴으로 돌아갑니다. (이전 턴 상대 돌과 내 돌 제거)
        const lastBlack = room.lastMoves.black;
        const lastWhite = room.lastMoves.white;

        // 1. 초반이라 아직 두 플레이어 모두 1번 이상 착수하지 않은 경우 방어
        if (!lastBlack || !lastWhite) {
          socket.emit('game:error', { message: '양측 모두 한 번씩 착수해야 무르기를 사용할 수 있습니다.' });
          return;
        }

        // 2. 보드 상태 확인 (중간에 증강으로 인해 돌이 변경되거나 파괴되었는지 검사)
        if (room.board[lastBlack.y][lastBlack.x] !== 'black' || 
            room.board[lastWhite.y][lastWhite.x] !== 'white') {
          socket.emit('game:error', { message: '최근 착수된 돌이 파괴되거나 색이 변하여 무르기를 사용할 수 없습니다.' });
          return;
        }

        // 3. 두 돌 모두 보드에서 삭제
        room.board[lastBlack.y][lastBlack.x] = '';
        room.board[lastWhite.y][lastWhite.x] = '';
        
        // 4. 한 번 무르기가 적용된 돌을 다시 무를 수 없도록 최근 착수 기록 초기화
        room.lastMoves.black = null;
        room.lastMoves.white = null;

        console.log(`[Undo] ${player.nickname} 님이 무르기를 사용했습니다. 흑(${lastBlack.x}, ${lastBlack.y}), 백(${lastWhite.x}, ${lastWhite.y}) 돌이 제거되었습니다.`);
      }

      // 사용 완료된 증강은 소모 처리 필요. 
      const targetAugment = player.augments.find((a) => a.id === augmentId && !a.isUsed);
      if (targetAugment) {
        targetAugment.isUsed = true;
      } else {
        socket.emit('game:error', { message: '이미 사용했거나 보유하지 않은 증강입니다.' });
        return;
      }

      const opponent = Array.from(room.players.values()).find(p => p.email !== userEmail);
          
      if (opponent && opponent.socketId) {
        io.to(opponent.socketId).emit('game:augment:notified', {
          nickname: player.nickname,
          augmentName: augmentData.name,
          description: augmentData.description
        });
      }

      // 갱신된 보드와 플레이어 상태를 방 전체에 동기화
      broadcastGameUpdate(io, room)

    } catch (err) {
      console.error('증강 사용 처리 중 오류:', err);
      socket.emit('game:error', { message: '증강 사용 처리 중 서버 오류가 발생했습니다.' });
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
            roomTitle: room.roomTitle,
            blackUserId: blackPlayer.userId,
            whiteUserId: whitePlayer.userId,
            winnerUserId: winner.userId,
            boardState: room.board,
            endReason: "SURRENDER",
            totalTurn: room.turnCount,
            selectedAugment: {
              black: blackPlayer.augments.map((a) => a.id),
              white: whitePlayer.augments.map((a) => a.id)
            }
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