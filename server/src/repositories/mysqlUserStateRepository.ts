import { RowDataPacket } from 'mysql2';
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

}