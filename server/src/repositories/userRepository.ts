// server/src/repositories/userRepository.ts
// 데이터 스키마 정의 및 인터페이스 정의 

// 시스템에서 사용할 유저 데이터 규격
export interface User {
  userId: number;                       // BIGINT -> number
  email: string;                        // VARCHAR(255)
  password: string;                     // VARCHAR(255)
  nickname: string;                     // VARCHAR(50)
  profileImage: string | null;          // VARCHAR(500) , NULL 허용
  createdAt: Date;                      // TIMESTAMP -> Date
  updatedAt: Date;                      // TIMESTAMP -> Date
  lastLoginAt: Date | null;             // TIMESTAMP, NULL 허용
  status: 'ACTIVE' | 'BANNED' | 'DELETED'; // VARCHAR(20) 유니온으로 정의
}

// 가상 메모리와 RDS가 공통으로 구현해야 할 저장소 명세서 (Mapper Interface)
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>; // 이메일로 유저 찾기
  signUp(user: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User>; // 회원 가입 
  update(userId: number, fieldsToUpdate: Partial<Omit<User, 'userId' | 'createdAt' | 'updatedAt'>>): Promise<User>; //회원 정보 수정
}