//뼈대만 만들어놓기
import { RowDataPacket } from "mysql2";
import { getDbPool } from "./mysqlClient";
import {
  GameRecordRepository,
  GameRecordList,
  GameRecordDetail,
} from "./gameRecordRepository";

export class MysqlGameRecordRepository implements GameRecordRepository {

  // 전적 목록 조회
  async findByUserId(userId: number): Promise<GameRecordList[]> {

  const pool = getDbPool();

  const query = `
    SELECT
      g.gameId,

      g.roomTitle,

      CASE
        WHEN g.winnerUserId IS NULL THEN 'draw'
        WHEN g.winnerUserId = ? THEN 'win'
        ELSE 'lose'
      END AS result,

      CASE
        WHEN g.blackUserId = ? THEN white.nickname
        ELSE black.nickname
      END AS opponentNickname,

      CASE
        WHEN g.blackUserId = ? THEN 'black'
        ELSE 'white'
      END AS myColor,

      g.totalTurn,
      g.endedAt

    FROM gameRecord g

    JOIN users black
      ON g.blackUserId = black.userId

    JOIN users white
      ON g.whiteUserId = white.userId

    WHERE
      g.blackUserId = ?
      OR g.whiteUserId = ?

    ORDER BY g.endedAt DESC
  `;

  const [rows] = await pool.query<RowDataPacket[]>(query, [
    userId,
    userId,
    userId,
    userId,
    userId,
  ]);

  return rows as GameRecordList[];

}

  // 대국 상세 조회
 async findByGameId(gameId: number): Promise<GameRecordDetail | null> {

  const pool = getDbPool();

  const query = `
    SELECT

      g.gameId,

      black.nickname AS blackNickname,
      black.profileImage AS blackProfileImage,

      white.nickname AS whiteNickname,
      white.profileImage AS whiteProfileImage,

      g.winnerUserId,
      g.boardState,
      g.endReason,
      g.totalTurn,
      g.startedAt,
      g.endedAt,
      g.selectedAugment

    FROM gameRecord g

    JOIN users black
      ON g.blackUserId = black.userId

    JOIN users white
      ON g.whiteUserId = white.userId

    WHERE g.gameId = ?
  `;

  const [rows] = await pool.query<RowDataPacket[]>(query, [gameId]);

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as GameRecordDetail;

}

// 게임 종료 기록 저장
async saveGameRecord(data: {
  roomTitle: string;
  blackUserId: number;
  whiteUserId: number;
  winnerUserId: number | null;
  boardState: string[][];
  endReason: string;
  totalTurn: number;
  selectedAugment?: { black: string[]; white: string[] };
}): Promise<void> {

  const pool = getDbPool();

  const query = `
    INSERT INTO gameRecord
    (
      roomTitle,
      blackUserId,
      whiteUserId,
      winnerUserId,
      boardState,
      endReason,
      totalTurn,
      selectedAugment,
      startedAt,
      endedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  await pool.query(query, [
    data.roomTitle,
    data.blackUserId,
    data.whiteUserId,
    data.winnerUserId,
    JSON.stringify(data.boardState),
    data.endReason,
    data.totalTurn,
    JSON.stringify(data.selectedAugment ?? { black: [], white: [] })
  ]);
}

}

export const gameRecordRepositoryImpl = new MysqlGameRecordRepository();