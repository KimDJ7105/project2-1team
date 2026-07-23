// // server/src/sessions/redisSessionManager.ts
import Redis from 'ioredis';
import crypto from 'crypto';
import { ISessionManager } from './sessionManager.interface';
import config from '../config/configLoader';

export class RedisSessionManager implements ISessionManager {
  private redisClient: Redis;

  constructor() {
    // application.yaml에서 로드한 Redis 설정 값을 사용
    this.redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined, // 빈 문자열은 undifined로 처리. 
    });

    this.redisClient.on('connect', () => {
      console.log('Redis 연결 성공');
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis 연결 에러:', err);
    });
  }

  // 해당하는 email에 토큰이 있는지 검사. 
  async getActiveSessionByEmail(email: string): Promise<string | null> {
    const sessionId = await this.redisClient.get(`user_session:${email}`);
    if (!sessionId) {
      return null;
    }

    // 세션 데이터가 실제로 존재하는지 교차 검증 (만료 시간 불일치로 인한 고아 키 방지)
    const exists = await this.redisClient.exists(`session:${sessionId}`);
    if (!exists) {
      await this.redisClient.del(`user_session:${email}`);
      return null;
    }

    return sessionId;
  }

  // 세션 생성: 토큰을 UUID 등으로 생성하고 Redis에 JSON 문자열로 저장
  async createSession(email: string, data: Record<string, any>, ttlSeconds: number): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    const sessionData = {
      email,
      ...data,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      this.redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), 'EX', ttlSeconds),
      this.redisClient.set(`user_session:${email}`, sessionId, 'EX', ttlSeconds)
    ]);

    return sessionId;
  }

  // 세션 조회: Redis에서 토큰을 찾아 object로 파싱
  async getSession(sessionId: string): Promise<Record<string, any> | null> {
    const rawData = await this.redisClient.get(`session:${sessionId}`);
    if (!rawData) {
      return null;
    }
    return JSON.parse(rawData);
  }
  // 세션 파괴 : Redis에서 세션 정보 삭제
  async destroySession(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    if (sessionData && sessionData.email) {
      await this.redisClient.del(`user_session:${sessionData.email}`);
    }
    await this.redisClient.del(`session:${sessionId}`);
  }

  // 세션 연장 : session 기간 연장 
  async touchSession(sessionId: string, ttlSeconds: number): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    if (sessionData && sessionData.email) {
      await this.redisClient.expire(`user_session:${sessionData.email}`, ttlSeconds);
    }
    await this.redisClient.expire(`session:${sessionId}`, ttlSeconds);
  }

  // 세션 일부 필드만 갱신하되 기존 TTL은 유지
  async updateSession(sessionId: string, updates: Record<string, any>): Promise<void> {
    const raw = await this.redisClient.get(`session:${sessionId}`);
    if (!raw) return;

    // TTL을 보존하기 위해 기존 키의 만료시간을 조회
    const ttl = await this.redisClient.ttl(`session:${sessionId}`);

    const sessionData = JSON.parse(raw);
    const newSessionData = { ...sessionData, ...updates };

    if (ttl && ttl > 0) {
      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(newSessionData), 'EX', ttl);
    } else {
      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(newSessionData));
    }

    // user_session:{email} 인덱스의 TTL도 갱신
    if (newSessionData.email) {
      if (ttl && ttl > 0) {
        await this.redisClient.set(`user_session:${newSessionData.email}`, sessionId, 'EX', ttl);
      } else {
        await this.redisClient.set(`user_session:${newSessionData.email}`, sessionId);
      }
    }
  }

  // 방 목록 조회용 (Redis Hash 전체 가져오기)
  async getAllRooms(): Promise<string[]> {
    return await this.redisClient.hvals('game_rooms');
  }

  // 방 생성/저장용
  async saveRoom(roomId: string, roomData: Record<string, any>): Promise<void> {
    await this.redisClient.hset('game_rooms', roomId, JSON.stringify(roomData));
  }

  // 방 삭제용
  async deleteRoom(roomId: string): Promise<void> {
    await this.redisClient.hdel('game_rooms', roomId);
  }

  async saveRoomState(roomId: string, state: any) {
    await this.redisClient.set(`gameroom:${roomId}`, JSON.stringify(state));
  }

  async getRoomState(roomId: string) {
    const data = await this.redisClient.get(`gameroom:${roomId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteRoomState(roomId: string) {
    await this.redisClient.del(`gameroom:${roomId}`);
  }

}

//싱글톤
export const redisSessionManager = new RedisSessionManager();