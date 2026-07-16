// server/src/repositories/index.ts
// 환경에 맞게 데이터 베이스를 연결 혹은 생성 

import config from '../config/configLoader';
import { UserRepository } from './userRepository';
import { MemoryUserRepository } from './memoryUserRepository';

let userRepository: UserRepository;

if (config.database.type === 'memory') {
  // 현재는 싱글톤 패턴처럼 서버 내에서 단 하나의 메모리 인스턴스만 공유하여 사용합
  userRepository = new MemoryUserRepository();
  console.log('[Repository] 가상 메모리 유저 저장소가 활성화되었습니다.');
} else {
  // TODO: 추후 AWS RDS MySQL 연동 시 구현체 작성 예정
  // userRepository = new MysqlUserRepository();
  throw new Error('MySQL 저장소는 아직 구현되지 않았습니다. application.yaml의 설정을 memory로 유지해 주세요.');
}

export { userRepository };