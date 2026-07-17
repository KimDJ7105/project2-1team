import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import config from '../config/configLoader';

let pool: mysql.Pool | null = null;

// 데이터베이스 풀 초기화 및 스키마 자동 생성 함수
export async function initializeDatabase(): Promise<mysql.Pool> {
  if (pool) return pool;

  const dbConfig = config.database;

  if (dbConfig.type !== 'mysql') {
    throw new Error('[DB] 현재 환경 설정이 mysql이 아닙니다.');
  }

  console.log('[DB] MySQL 데이터베이스 연결 풀을 생성합니다...');
  
  // 1. 커넥션 풀 생성
  pool = mysql.createPool({
    host: dbConfig.host || '127.0.0.1',
    port: dbConfig.port || 3306,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true // schema.sql 내부의 여러 쿼리를 동시에 실행할 수 있도록 허용
  });

  // 2. schema.sql 파일을 읽어와 자동 테이블 생성 실행
  try {
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('[DB] schema.sql 스키마 동기화가 완료되었습니다.');
    } else {
      console.warn('[DB] 프로젝트 루트에서 schema.sql 파일을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('[DB] 스키마 자동 생성 중 오류가 발생했습니다:', error);
    throw error;
  }

  return pool;
}

// 다른 파일에서 쿼리를 날릴 때 사용할 안전한 풀 getter 함수
export function getDbPool(): mysql.Pool {
  if (!pool) {
    throw new Error('[DB] 데이터베이스가 아직 초기화되지 않았습니다. initializeDatabase()를 먼저 호출하세요.');
  }
  return pool;
}