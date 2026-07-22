import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDbPool } from './mysqlClient';
import { UserState, UserStateRepository } from './userStateRepository';

export class MysqlUserStateRepository implements UserStateRepository {

  async findByUserId(userId: number): Promise<UserState | null> {

    const pool = getDbPool();

    const query = `
      SELECT *
      FROM userState
      WHERE userId = ?
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as UserState;
  }


  // 게임 결과 반영 (없으면 새로 생성, 있으면 갱신)
  async applyGameResult(
    userId: number,
    result: 'win' | 'lose' | 'draw',
    ratingChange: number
  ): Promise<UserState> {

    const pool = getDbPool();

    const winInc = result === 'win' ? 1 : 0;
    const loseInc = result === 'lose' ? 1 : 0;
    const drawInc = result === 'draw' ? 1 : 0;

    // userId가 없으면 기본값(1200)에서 시작해서 INSERT,
    // 이미 있으면 기존 값에 더해서 UPDATE (한 쿼리로 원자적 처리)
    const query = `
      INSERT INTO userState (userId, totalGames, winCount, loseCount, drawCount, rating)
      VALUES (?, 1, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        totalGames = totalGames + 1,
        winCount = winCount + VALUES(winCount),
        loseCount = loseCount + VALUES(loseCount),
        drawCount = drawCount + VALUES(drawCount),
        rating = rating + ?
    `;

    // 신규 생성 시 rating은 "1200 + 변화량"
    const initialRating = 1200 + ratingChange;

    const values = [
      userId,
      winInc,
      loseInc,
      drawInc,
      initialRating,
      ratingChange,
    ];

    await pool.query<ResultSetHeader>(query, values);

    const selectQuery = `
      SELECT *
      FROM userState
      WHERE userId = ?
    `;

    const [rows] = await pool.query<RowDataPacket[]>(selectQuery, [userId]);

    if (rows.length === 0) {
      throw new Error('전적 정보를 찾을 수 없습니다.');
    }

    return rows[0] as UserState;
  }

}

export const userStateRepositoryImpl = new MysqlUserStateRepository();