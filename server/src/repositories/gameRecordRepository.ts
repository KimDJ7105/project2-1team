export interface GameRecordList {
  gameId: number;

  result: "win" | "lose" | "draw";

  opponentNickname: string;

  myColor: "black" | "white";

  totalTurn: number;

  endedAt: Date;
}

export interface GameRecordDetail {
  gameId: number;

  blackNickname: string;
  blackProfileImage: string;

  whiteNickname: string;
  whiteProfileImage: string;

  winnerUserId: number | null;

  boardState: unknown;

  endReason: string;

  totalTurn: number;

  startedAt: Date;

  endedAt: Date;

  selectedAugment: unknown;
}

export interface GameRecordRepository {
// 전적 목록 조회
  findByUserId(userId:number):Promise<GameRecordList[]>;
// 대국 상세 조회 
  findByGameId(gameId:number):Promise<GameRecordDetail | null>;


  // 대국 종료 후 기록 저장
  saveGameRecord(data: {
    blackUserId: number;
    whiteUserId: number;
    winnerUserId: number | null;
    boardState: string[][];
    endReason: string;
    totalTurn: number;
    selectedAugment?: { black: string[]; white: string[] };
  }): Promise<void>;
}