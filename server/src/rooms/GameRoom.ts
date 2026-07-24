// server/src/rooms/GameRoom.ts

import { AUGMENT_LIST, IAugment } from '../shared/data/augments';
import { redisSessionManager } from '../sessions/redisSessionManager';

export interface Player {
  userId: number;
  email: string;
  nickname: string;
  profileImage?: string | null;
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
  public pendingAugmentPlayers: string[] = [];
  public pendingAugmentOptions: Map<string, any[]> = new Map();
  public sealedCells: { x: number; y: number; turnsRemaining: number }[] = [];
  public hiddenStones: { x: number; y: number; email: string; turnsRemaining: number }[] = [];
  public lastMoves: { black: { x: number; y: number } | null; white: { x: number; y: number } | null } = { black: null, white: null };

  constructor(roomId: string, roomTitle: string, data?: any) {
    this.roomId = roomId;
    this.roomTitle = roomTitle;

    if (data) {
      this.board = data.board || Array(15).fill(null).map(() => Array(15).fill(''));
      this.players = new Map(Object.entries(data.players || {}));
      this.currentTurn = data.currentTurn || 'black';
      this.status = data.status || 'waiting';
      this.turnCount = data.turnCount || 1;
      this.pendingAugmentPlayers = data.pendingAugmentPlayers || [];
      this.pendingAugmentOptions = new Map(Object.entries(data.pendingAugmentOptions || {}));
      this.sealedCells = data.sealedCells || [];
      this.hiddenStones = data.hiddenStones || [];
      this.lastMoves = data.lastMoves || { black: null, white: null };
    } else {
      this.board = Array(15).fill(null).map(() => Array(15).fill(''));
    }
  }

  // 플레이어 참가
  public addPlayer(userId: number, email: string, nickname: string, socketId: string, profileImage?: string | null): boolean {
    if (this.players.has(email)) {
      // 이미 참가 중인 경우 소켓 ID와 변경된 필드만 갱신 (null/undefined로 기존값 덮어쓰기 금지)
      const player = this.players.get(email)!;
      player.socketId = socketId;
      if (nickname && nickname !== player.nickname) {
        player.nickname = nickname;
      }
      if (profileImage) {
        player.profileImage = profileImage;
      }
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
      profileImage: profileImage ?? null,
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
    this.lastMoves = { black: null, white: null };
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

    const isSealed = this.sealedCells.some(cell => cell.x === x && cell.y === y);
    if (isSealed) {
      return { success: false, message: '봉인된 칸에는 돌을 둘 수 없습니다.' };
    }

    // 바둑판에 돌 배치
    if (player.color === 'black') {
      const ruleCheck = this.checkRenjuRule(x, y, player.color);
      if (!ruleCheck.isValid) {
        return { success: false, message: ruleCheck.reason };
      }
    }

    if (hiddenTargetIndex !== -1) {
      this.hiddenStones.splice(hiddenTargetIndex, 1);
      hiddenMoveCrushed = true;
    }

    this.board[y][x] = this.currentTurn;
    
    // 방금 착수한 돌의 좌표를 기록
    this.lastMoves[this.currentTurn] = { x, y };

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

  // 지정된 방향으로 9칸짜리 문자열 추출 (X: 내 돌, _: 빈칸, O: 상대 돌 및 벽)
  private getLineString(x: number, y: number, dx: number, dy: number, color: string): string {
    let str = '';
    for (let i = -4; i <= 4; i++) {
      const nx = x + i * dx;
      const ny = y + i * dy;
      if (nx < 0 || nx > 14 || ny < 0 || ny > 14) {
        str += 'O';
      } else {
        const cell = this.board[ny][nx];
        if (cell === color) str += 'X';
        else if (cell === '') str += '_';
        else str += 'O';
      }
    }
    return str;
  }

  // 4가 만들어지는 개수 계산
  private getFoursCount(line: string): number {
    const winningIndices: number[] = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '_') {
        const testLine = line.substring(0, i) + 'X' + line.substring(i + 1);
        if (testLine.includes('XXXXX') && !testLine.includes('XXXXXX')) {
          winningIndices.push(i);
        }
      }
    }
    
    if (winningIndices.length === 0) return 0;
    if (winningIndices.length === 1) return 1;
    if (winningIndices.length === 2) {
      if (winningIndices[1] - winningIndices[0] === 5) {
        return 1;
      }
      return 2;
    }
    return 2;
  }

  // 열린 3이 존재하는지 판별
  private hasOpenThree(line: string): boolean {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '_') {
        const testLine = line.substring(0, i) + 'X' + line.substring(i + 1);
        if (this.getFoursCount(testLine) === 1) {
          const winIndices: number[] = [];
          for (let j = 0; j < testLine.length; j++) {
            if (testLine[j] === '_') {
              const testLine2 = testLine.substring(0, j) + 'X' + testLine.substring(j + 1);
              if (testLine2.includes('XXXXX') && !testLine2.includes('XXXXXX')) {
                winIndices.push(j);
              }
            }
          }
          if (winIndices.length === 2 && winIndices[1] - winIndices[0] === 5) {
             return true;
          }
        }
      }
    }
    return false;
  }

  // 렌주룰 통합 검증 로직
  private checkRenjuRule(x: number, y: number, color: string): { isValid: boolean; reason?: string } {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    let isFive = false;
    let isOverline = false;
    let totalFours = 0;
    let totalOpenThrees = 0;

    this.board[y][x] = color;

    for (const [dx, dy] of directions) {
      const line = this.getLineString(x, y, dx, dy, color);

      if (line.includes('XXXXXX')) isOverline = true;
      if (line.includes('XXXXX') && !line.includes('XXXXXX')) isFive = true;

      totalFours += this.getFoursCount(line);
      if (this.hasOpenThree(line)) totalOpenThrees++;
    }

    this.board[y][x] = '';

    // 정확히 5목이 완성되면 모든 금수를 무시하고 승리 처리
    if (isFive) return { isValid: true };

    if (isOverline) return { isValid: false, reason: '6목 이상(장목)은 금수입니다.' };
    if (totalFours >= 2) return { isValid: false, reason: '4-4 자리는 금수입니다.' };
    if (totalOpenThrees >= 2) return { isValid: false, reason: '3-3 자리는 금수입니다.' };

    return { isValid: true };
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
      if (count === 5) {
        return true;
      }
    }

    return false;
  }

  public triggerAugmentSelection(io: any): void {
    this.pendingAugmentPlayers = [];
    this.pendingAugmentOptions.clear();

    for (const player of this.players.values()) {
      this.pendingAugmentPlayers.push(player.email);

      // 본인이 이미 가진 증강은 객체의 id를 기준으로 비교하여 제외
      const availableAugments = AUGMENT_LIST.filter(
        (aug) => !player.augments.some((pAug) => pAug.id === aug.id)
      );

      // 무작위로 섞어서 3개 추출
      const shuffled = [...availableAugments].sort(() => Math.random() - 0.5);
      const selectedOptions = shuffled.slice(0, 3);

      // 생성된 옵션을 메모리에 저장
      this.pendingAugmentOptions.set(player.email, selectedOptions);

      // 개별 소켓으로 증강 선택지 3개 발송
      io.to(player.socketId).emit('game:augment:select', {
        options: selectedOptions,
      });
    }

    console.log(`[Augment Trigger] 방 ID: ${this.roomId}, 현재 등록된 플레이어 수: ${this.players.size}명, 대기 명단:`, this.pendingAugmentPlayers);

    gameRoomManager.saveRoom(this).catch(err => {
      console.error('증강 트리거 상태 Redis 저장 오류:', err);
    });
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

  // Redis 저장을 위해 순수 JSON 객체로 변환
  public toJSON() {
    return {
      roomId: this.roomId,
      roomTitle: this.roomTitle,
      players: Object.fromEntries(this.players),
      board: this.board,
      currentTurn: this.currentTurn,
      status: this.status,
      turnCount: this.turnCount,
      pendingAugmentPlayers: Array.from(this.pendingAugmentPlayers),
      pendingAugmentOptions: Object.fromEntries(this.pendingAugmentOptions),
      sealedCells: this.sealedCells,
      hiddenStones: this.hiddenStones,
      lastMoves: this.lastMoves,
    };
  }
}

class GameRoomManager {
  public async getRoom(roomId: string): Promise<GameRoom | undefined> {
    const rawData = await redisSessionManager.getRoomState(roomId); // Redis 전용 조회 메서드 활용 필요 혹은 아래 구현 참조
    if (!rawData) return undefined;
    return new GameRoom(rawData.roomId, rawData.roomTitle, rawData);
  }

  public async saveRoom(room: GameRoom): Promise<void> {
    await redisSessionManager.saveRoomState(room.roomId, room.toJSON());
  }

  public async createRoom(roomId: string, roomTitle: string): Promise<GameRoom> {
    const room = new GameRoom(roomId, roomTitle);
    await this.saveRoom(room);
    return room;
  }

  public async deleteRoom(roomId: string): Promise<void> {
    console.log("방 삭제, ID : ", roomId);
    await redisSessionManager.deleteRoomState(roomId);
  }

  public async leaveRoom(roomId: string, identifier: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;
    
    for (const [email, player] of room.players.entries()) {
      if (player.socketId === identifier || email === identifier) {
        room.removePlayer(email);
        break;
      }
    }

    if (room.players.size === 0) {
      await this.deleteRoom(roomId);
    } else {
      await this.saveRoom(room);
    }
  }
}

export const gameRoomManager = new GameRoomManager();