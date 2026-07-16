// server/src/repositories/memoryUserRepository.ts
// dev 환경에서 사용할 인 메모리 데이터 저장공간

import { User, UserRepository } from './userRepository';

export class MemoryUserRepository implements UserRepository {
  // 실제 DB 대신 유저 정보를 임시 저장할 메모리 Map
  private users = new Map<number, User>();
  private idCounter = 1;

  // 아이디(email)로 유저 검색
  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  // 회원 등록
  async signUp(userData: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const newUserId = this.idCounter++;
    const now = new Date();
    
    const newUser: User = {
      userId: newUserId,
      ...userData,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(newUserId, newUser);
    return newUser;
  }
}