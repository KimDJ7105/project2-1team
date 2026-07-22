// server/src/services/userService.ts

import bcrypt from 'bcrypt';
import { userRepository } from '../repositories';
import { User } from '../repositories/userRepository';

export class UserService {
  private saltRounds = 10;

  // 회원가입  로직
  async register(email: string, password: string, nickname: string): Promise<Omit<User, 'password'>> {
    // 중복 이메일 가입 방지
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('이미 사용 중인 이메일 주소입니다.');
    }

    // 비밀번호 단방향 해싱 암호화
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // 저장소에 새로운 유저 정보 기록
    const savedUser = await userRepository.signUp({
      email,
      password: hashedPassword,
      nickname,
      profileImage: null,
      lastLoginAt: null,
      status: 'ACTIVE',
    });

    // 비밀번호 정보는 결과 객체에서 제외하고 반환
    const { password: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }

  // 로그인 로직
  async login(email: string, password: string): Promise<Omit<User, 'password'>> {
    // 가입된 이메일인지 검증
    const user = await userRepository.findByEmail(email);
    // 디버깅: 사용자 존재 여부 및 비밀번호 형태(길이, bcrypt 접두사) 확인
    const found = !!user;
    console.log(`[Auth Debug] found: ${found}`);
    console.log(`[Auth Debug] inputPasswordLength: ${password ? password.length : 0}`);
    if (user && user.password) {
      const dbPwd = user.password;
      console.log(`[Auth Debug] dbPasswordLength: ${dbPwd.length}, dbStartsWith$2: ${dbPwd.startsWith('$2')}`);
    } else {
      console.log('[Auth Debug] dbPasswordLength: 0, dbStartsWith$2: false');
    }

    if (!user) {
      throw new Error('이메일 혹은 비밀번호를 확인해 주세요.');
    }

    // 계정 상태 체크
    if (user.status !== 'ACTIVE') {
      throw new Error('비활성화되었거나 차단된 계정입니다.');
    }

    // 입력된 비밀번호와 해싱된 비밀번호 일치 여부 대조
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    console.log(`[Auth Debug] bcryptCompare: ${isPasswordMatch}`);
    if (!isPasswordMatch) {
      throw new Error('이메일 혹은 비밀번호를 확인해 주세요.');
    }

    // 로그인 시간 업데이트 
    const updatedUser = await userRepository.update(user.userId, {
      lastLoginAt: new Date(),
    });

    // 비밀번호를 제외한 유저 프로필 반환
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }
}

// 싱글톤 객체로 비즈니스 서비스 인스턴스 제공
export const userService = new UserService();