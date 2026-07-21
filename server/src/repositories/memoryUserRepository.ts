// server/src/repositories/memoryUserRepository.ts
// dev 환경에서 사용할 인 메모리 데이터 저장공간

import { User, UserRepository } from './userRepository';

export class MemoryUserRepository implements UserRepository { // 인 메모리 Mapper 
  // 실제 DB 대신 유저 정보를 임시 저장할 메모리 Map
  private users = new Map<number, User>();
  private idCounter = 1;

  // 아이디(email)로 유저 검색
  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) { // map을 순차 탐색
      if (user.email === email) { // 동일한 이메일 검사
        return user;
      }
    }
    return null;
  }

  // userId로 유저 검색
async findById(userId: number): Promise<User | null> {

  const user = this.users.get(userId);

  return user ?? null;
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

  // 정보 수정
  async update(userId: number, fieldsToUpdate: Partial<Omit<User, 'userId' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('존재하지 않는 사용자입니다.');
    }

    // 기존 데이터에 변경된 필드만 덮어쓰고, 수정일을 갱신
    const updatedUser: User = {
      ...user,
      ...fieldsToUpdate,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }
}