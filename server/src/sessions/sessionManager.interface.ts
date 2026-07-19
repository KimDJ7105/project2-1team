export interface ISessionManager {
  // 세션 생성 (로그인 성공 시 세션 토큰 반환)
  createSession(userId: string, data: Record<string, any>, ttlSeconds: number): Promise<string>;

  // 세션 조회 (토큰으로 유저 세션 데이터 확인)
  getSession(sessionId: string): Promise<Record<string, any> | null>;

  // 세션 만료 (로그아웃 시 세션 삭제)
  destroySession(sessionId: string): Promise<void>;

  // 세션 연장 (실시간 활동 시 만료 시간 갱신)
  touchSession(sessionId: string, ttlSeconds: number): Promise<void>;
}