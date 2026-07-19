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

  // 세션 생성: 토큰을 UUID 등으로 생성하고 Redis에 JSON 문자열로 저장
  async createSession(userId: string, data: Record<string, any>, ttlSeconds: number): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    const sessionData = {
      userId,
      ...data,
      createdAt: new Date().toISOString(),
    };

    await this.redisClient.set(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      'EX',
      ttlSeconds
    );

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
    await this.redisClient.del(`session:${sessionId}`);
  }

  // 세션 연장 : session 기간 연장 
  async touchSession(sessionId: string, ttlSeconds: number): Promise<void> {
    await this.redisClient.expire(`session:${sessionId}`, ttlSeconds);
  }
}