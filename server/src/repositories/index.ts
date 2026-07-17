// server/src/repositories/index.ts
// 환경에 맞게 데이터 베이스를 연결 혹은 생성 

import config from '../config/configLoader';
import { UserRepository } from './userRepository';
import { MemoryUserRepository } from './memoryUserRepository';
import { MysqlUserRepository } from './mysqlUserRepository';

let userRepository: UserRepository;

if (config.database.type === 'memory') {
  // 현재는 싱글톤 패턴처럼 서버 내에서 단 하나의 메모리 인스턴스만 공유하여 사용합
  userRepository = new MemoryUserRepository();
  console.log('[Repository] 가상 메모리 유저 저장소가 활성화되었습니다.');
} else {
  userRepository = new MysqlUserRepository();
  console.log('[Repository] mySQL 저장소가 활성화되었습니다.');
}

export { userRepository };