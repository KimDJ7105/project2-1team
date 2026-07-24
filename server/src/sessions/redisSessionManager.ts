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
}

//싱글톤
export const redisSessionManager = new RedisSessionManager();