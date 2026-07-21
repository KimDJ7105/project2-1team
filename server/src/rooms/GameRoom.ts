// server/src/rooms/GameRoom.ts

export interface Player {
  email: string;
  nickname: string;
  socketId: string;
  color: 'black' | 'white';
  isReady: boolean;
}

export class GameRoom {
  public roomId: string;
  public roomTitle: string;
  public players: Map<string, Player> = new Map(); // key: userEmail
  public board: string[][]; // 15x15 오목판 (빈칸: "", "black", "white")
  public currentTurn: 'black' | 'white' = 'black';
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';

  constructor(roomId: string, roomTitle: string) {
    this.roomId = roomId;
    this.roomTitle = roomTitle;
    this.board = Array(15).fill(null).map(() => Array(15).fill(''));
  }

  // 플레이어 참가
  public addPlayer(email: string, nickname: string, socketId: string): boolean {
    if (this.players.has(email)) {
      // 이미 참가 중인 경우 소켓 ID만 갱신
      const player = this.players.get(email)!;
      player.socketId = socketId;
      return true;
    }

    if (this.players.size >= 2) {
      // 자리가 꽉 찬 경우
      return false;
    }

    // 첫 번째 유저는 흑돌, 두 번째 유저는 백돌 지정
    // todo. 게임 시작 전 선택 하게 하거나 랜덤으로 돌리기
    const color = this.players.size === 0 ? 'black' : 'white';
    
    this.players.set(email, {
      email,
      nickname,
      socketId,
      color,
      isReady: false
    });

    return true;
  }

  // 플레이어 퇴장
  public removePlayer(email: string): void {
    this.players.delete(email);
  }

  // 게임판 초기화
  public resetGame(): void {
    this.board = Array(15).fill(null).map(() => Array(15).fill(''));
    this.currentTurn = 'black';
    this.status = 'waiting';
  }
}

class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  // 메모리에 룸 인스턴스 생성
  public createRoom(roomId: string, roomTitle: string): GameRoom {
    const room = new GameRoom(roomId, roomTitle);
    this.rooms.set(roomId, room);
    return room;
  }

  // 특정 룸 인스턴스 가져오기
  public getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // 룸 인스턴스 삭제
  public deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  public leaveRoom(roomId: string, socketId: string): void {
    const room = this.getRoom(roomId);
    if (!room) return;

    for (const [email, player] of room.players.entries()) {
      if (player.socketId === socketId) {
        room.removePlayer(email);
        break;
      }
    }

    // 방에 남은 인원이 없다면 메모리에서 방 인스턴스 삭제
    if (room.players.size === 0) {
      this.deleteRoom(roomId);
    }
  }
}

export const gameRoomManager = new GameRoomManager();