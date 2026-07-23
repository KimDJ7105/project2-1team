// server/src/rooms/GameRoom.ts

import { AUGMENT_LIST, IAugment } from '../shared/data/augments';

export interface Player {
  userId: number;
  email: string;
  nickname: string;
  socketId: string;
  color: 'black' | 'white';
  isReady: boolean;
  augments: IAugment[];
  activeEffects: { id: string; turnsRemaining: number }[];
}

export class GameRoom {
  public roomId: string;
  public roomTitle: string;
  public players: Map<string, Player> = new Map(); // key: userEmail
  public board: string[][]; // 15x15 오목판 (빈칸: "", "black", "white")
  public currentTurn: 'black' | 'white' = 'black';
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';
  public turnCount: number = 1;
  // 증강 선택을 대기 중인 플레이어 이메일 목록
  public pendingAugmentPlayers: Set<string> = new Set();
  public sealedCells: { x: number; y: number; turnsRemaining: number }[] = [];
  public hiddenStones: { x: number; y: number; email: string; turnsRemaining: number }[] = [];

  constructor(roomId: string, roomTitle: string) {
    this.roomId = roomId;
    this.roomTitle = roomTitle;
    this.board = Array(15).fill(null).map(() => Array(15).fill(''));
  }

  // 플레이어 참가
  public addPlayer(userId: number, email: string, nickname: string, socketId: string): boolean {
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

    // 임시로 첫 번째 유저는 흑돌, 두 번째 유저는 백돌 지정
    const color = this.players.size === 0 ? 'black' : 'white';
    
    this.players.set(email, {
      userId,
      email,
      nickname,
      socketId,
      color,
      isReady: false,
      augments: [],
      activeEffects : []
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
    this.turnCount = 1;
    this.sealedCells = [];
    this.hiddenStones = [];
  }

  // 착수 검증 및 처리 메서드
  public putStone(email: string, x: number, y: number): { success: boolean; message?: string; isWin?: boolean; color?: 'black' | 'white'; hiddenMoveCrushed?: boolean } {
    if (this.status !== 'playing') {
      return { success: false, message: '진행 중인 게임이 아닙니다.' };
    }

    const player = this.players.get(email);
    if (!player) {
      return { success: false, message: '방에 참여한 플레이어가 아닙니다.' };
    }

    if (player.color !== this.currentTurn) {
      return { success: false, message: '현재 본인의 차례가 아닙니다.' };
    }

    if (x < 0 || x > 14 || y < 0 || y > 14) {
      return { success: false, message: '바둑판 영역을 벗어난 좌표입니다.' };
    }

    let hiddenMoveCrushed = false;
    const hiddenTargetIndex = this.hiddenStones.findIndex(stone => stone.x === x && stone.y === y && stone.email !== email);
    
    // 원래 돌이 있으면서, 그 돌이 상대의 숨겨진 돌이 아닌 경우에만 착수 거부
    if (this.board[y][x] !== '' && hiddenTargetIndex === -1) {
      return { success: false, message: '이미 돌이 놓여 있는 자리입니다.' };
    }

    // 상대의 숨겨진 돌 자리를 클릭했다면, 숨겨진 돌 배열에서 제거하고 덮어씌움
    if (hiddenTargetIndex !== -1) {
      this.hiddenStones.splice(hiddenTargetIndex, 1);
      hiddenMoveCrushed = true;
    }

    const isSealed = this.sealedCells.some(cell => cell.x === x && cell.y === y);
    if (isSealed) {
      return { success: false, message: '봉인된 칸에는 돌을 둘 수 없습니다.' };
    }

    // 바둑판에 돌 배치
    this.board[y][x] = this.currentTurn;

    const pendingEffectIndex = player.activeEffects.findIndex(e => e.id === 'hidden_move_pending');
    if (pendingEffectIndex !== -1) {
        // 상대 턴 1번 진행 후 내 턴이 돌아오기 직전에 풀리도록 turnsRemaining을 2로 설정
        this.hiddenStones.push({ x, y, email, turnsRemaining: 2 }); 
        // 효과 제거 (1회성)
        player.activeEffects.splice(pendingEffectIndex, 1);
    }

    // 승리 조건 검사
    const isWin = this.checkWin(x, y, this.currentTurn);
    if (isWin) {
      this.status = 'finished';
      return { success: true, isWin: true, color: this.currentTurn, hiddenMoveCrushed : hiddenMoveCrushed };
    }

    // 다음 턴으로 교체 및 턴 수 증가
    this.currentTurn = this.currentTurn === 'black' ? 'white' : 'black';
    this.turnCount += 1;

    this.tickEffects(player.email);
    this.tickSealedCells();
    this.tickHiddenStones();

    return { success: true, isWin: false, color: player.color, hiddenMoveCrushed : hiddenMoveCrushed };
  }

  public tickHiddenStones(): void {
    this.hiddenStones = this.hiddenStones
      .map(stone => ({ ...stone, turnsRemaining: stone.turnsRemaining - 1 }))
      .filter(stone => stone.turnsRemaining > 0);
  }

  public tickSealedCells(): void {
    this.sealedCells = this.sealedCells
      .map(cell => ({ ...cell, turnsRemaining: cell.turnsRemaining - 1 }))
      .filter(cell => cell.turnsRemaining > 0);
  }

  // 4방향 5목 판정 알고리즘
  private checkWin(x: number, y: number, color: string): boolean {
    const directions = [
      [1, 0],   // 가로
      [0, 1],   // 세로
      [1, 1],   // 우하향 대각선
      [1, -1]   // 우상향 대각선
    ];

    for (const [dx, dy] of directions) {
      let count = 1; // 방금 놓은 돌 포함

      // 정방향 탐색
      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && nx <= 14 && ny >= 0 && ny <= 14 && this.board[ny][nx] === color) {
        count++;
        nx += dx;
        ny += dy;
      }

      // 역방향 탐색
      nx = x - dx;
      ny = y - dy;
      while (nx >= 0 && nx <= 14 && ny >= 0 && ny <= 14 && this.board[ny][nx] === color) {
        count++;
        nx -= dx;
        ny -= dy;
      }

      // 연속된 돌이 5개 이상이면 승리
      if (count >= 5) {
        return true;
      }
    }

    return false;
  }

  public triggerAugmentSelection(io: any): void {
    this.pendingAugmentPlayers.clear();

    for (const player of this.players.values()) {
      this.pendingAugmentPlayers.add(player.email);

      // 본인이 이미 가진 증강은 객체의 id를 기준으로 비교하여 제외
      const availableAugments = AUGMENT_LIST.filter(
        (aug) => !player.augments.some((pAug) => pAug.id === aug.id)
      );

      // 무작위로 섞어서 3개 추출
      const shuffled = [...availableAugments].sort(() => Math.random() - 0.5);
      const selectedOptions = shuffled.slice(0, 3);

      // 개별 소켓으로 증강 선택지 3개 발송
      io.to(player.socketId).emit('game:augment:select', {
        options: selectedOptions,
      });
    }
  }

  // 턴이 종료될 때 해당 플레이어의 지속 효과 턴 수를 차감, 만료된 효과를 제거
  public tickEffects(email: string): void {
    const player = this.players.get(email);
    if (!player || !player.activeEffects) return;

    player.activeEffects = player.activeEffects
      .map((effect) => ({
        ...effect,
        turnsRemaining: effect.turnsRemaining - 1,
      }))
      .filter((effect) => effect.turnsRemaining > 0);
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

  // 전체 룸 인스턴스 목록 가져오기
  public getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  // 룸 인스턴스 삭제
  public deleteRoom(roomId: string): void {
    console.log("방 삭제, ID : ", roomId);
    this.rooms.delete(roomId);
  }

  public leaveRoom(roomId: string, identifier: string): void {
    const room = this.getRoom(roomId);
    if (!room) return;
    
    // socketId뿐만 아니라 맵의 key인 userEmail로도 대조하여 확실하게 플레이어 제거
    for (const [email, player] of room.players.entries()) {
      if (player.socketId === identifier || email === identifier) {
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