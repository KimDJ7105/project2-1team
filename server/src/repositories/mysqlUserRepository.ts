/*server/src/repositories/mysqlUserRepository.ts */
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDbPool } from './mysqlClient';
import { User, UserRepository } from './userRepository';

export class MysqlUserRepository implements UserRepository {
  // 1. 이메일로 유저 찾기
  async findByEmail(email: string): Promise<User | null> {
    const pool = getDbPool();
    const query = 'SELECT * FROM users WHERE email = ?';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, [email]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as User;
  }
// 1-2. 유저 ID로 찾기
async findById(userId: number): Promise<User | null> {

  const pool = getDbPool();

  const query =
    'SELECT * FROM users WHERE userId = ?';

  const [rows] =
    await pool.query<RowDataPacket[]>(
      query,
      [userId]
    );

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as User;
}
  // 2. 회원 가입
  async signUp(userData: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const pool = getDbPool();
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
      userData.status
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

    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    const values: any[] = Object.values(fieldsToUpdate);
    values.push(userId); 

    const query = `UPDATE users SET ${setClause} WHERE userId = ?`;
    await pool.query(query, values);

    // 업데이트에서는 기존 전체 데이터를 알지 못하므로 최신 유저 정보를 안전하게 재조회하여 반환
    const selectQuery = 'SELECT * FROM users WHERE userId = ?';
    const [rows] = await pool.query<RowDataPacket[]>(selectQuery, [userId]);

    if (rows.length === 0) {
      throw new Error('존재하지 않는 사용자입니다.');
    }

    return rows[0] as User;
  }
}