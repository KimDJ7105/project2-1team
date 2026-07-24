/*server/src/repositories/mysqlUserRepository.ts */
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDbPool } from './mysqlClient';
import { User, UserRepository } from './userRepository';

export class MysqlUserRepository implements UserRepository {
  // 1. 이메일로 유저 찾기
  async findByEmail(email: string): Promise<User | null> {
    const pool = getDbPool();
    // DB uses camelCase column names; select explicit columns to match `User` interface
    const query = `
      SELECT
        userId,
        email,
        password,
        nickname,
        profileImage,
        createdAt,
        updatedAt,
        lastLoginAt,
        status
      FROM users
      WHERE email = ?
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, [email]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as User;
  }
// 1-2. 유저 ID로 찾기
async findById(userId: number): Promise<User | null> {

  const pool = getDbPool();

  const query = `
    SELECT
      userId,
      email,
      password,
      nickname,
      profileImage,
      createdAt,
      updatedAt,
      lastLoginAt,
      status
    FROM users
    WHERE userId = ?
  `;

  const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as User;
}
  // 2. 회원 가입
  async signUp(userData: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const pool = getDbPool();
    // DB uses camelCase column names; insert using those names
    const query = `
      INSERT INTO users (email, password, nickname, profileImage, lastLoginAt, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      userData.email,
      userData.password,
      userData.nickname,
      userData.profileImage,
      userData.lastLoginAt,
      userData.status,
    ];

    const [result] = await pool.query<ResultSetHeader>(query, values);
    const insertId = result.insertId;

    // 전달받은 데이터와 생성된 ID를 결합하여 객체 생성
    const now = new Date();
    return {
      userId: insertId,
      ...userData,
      createdAt: now,
      updatedAt: now
    } as User;
  }

  // 3. 회원 정보 수정
  async update(userId: number, fieldsToUpdate: Partial<Omit<User, 'userId' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    const pool = getDbPool();
    
    const keys = Object.keys(fieldsToUpdate);
    if (keys.length === 0) {
      throw new Error('수정할 필드가 지정되지 않았습니다.');
    }
    // DB uses camelCase column names; use keys as-is for SET clause
    const setParts: string[] = [];
    const values: any[] = [];

    for (const key of keys) {
      setParts.push(`${key} = ?`);
      // @ts-ignore
      values.push((fieldsToUpdate as any)[key]);
    }

    values.push(userId);

    const setClause = setParts.join(', ');
    const query = `UPDATE users SET ${setClause} WHERE userId = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    if (result.affectedRows === 0) {
      throw new Error('업데이트할 사용자가 존재하지 않거나 변경된 내용이 없습니다.');
    }

    // 업데이트 후 최신 레코드를 재조회하여 반환 (DB uses camelCase)
    const selectQuery = `
      SELECT
        userId,
        email,
        password,
        nickname,
        profileImage,
        createdAt,
        updatedAt,
        lastLoginAt,
        status
      FROM users
      WHERE userId = ?
    `;

    const [rows] = await pool.query<RowDataPacket[]>(selectQuery, [userId]);

    if (rows.length === 0) {
      throw new Error('존재하지 않는 사용자입니다.');
    }

    return rows[0] as User;
  }
}