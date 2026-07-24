// server/src/sessions/sessionManager.interface.ts
export interface ISessionManager {
  // email로 토큰 검색 
  getActiveSessionByEmail(email: string): Promise<string | null>;

  // 세션 생성 (로그인 성공 시 세션 토큰 반환)
  createSession(userId: string, data: Record<string, any>, ttlSeconds: number): Promise<string>;

  // 세션 조회 (토큰으로 유저 세션 데이터 확인)
  getSession(sessionId: string): Promise<Record<string, any> | null>;

  // 세션 만료 (로그아웃 시 세션 삭제)
  destroySession(sessionId: string): Promise<void>;

  // 세션 연장 (실시간 활동 시 만료 시간 갱신)
  touchSession(sessionId: string, ttlSeconds: number): Promise<void>;

  // 세션 일부 필드만 갱신하되 기존 TTL은 유지
  updateSession(sessionId: string, updates: Record<string, any>): Promise<void>;

  // 방 목록 조회용 (Redis Hash 전체 가져오기)
  getAllRooms(): Promise<string[]>;

  // 방 생성/저장용
  saveRoom(roomId: string, roomData: Record<string, any>): Promise<void>;

  // 중복 로그인 방지용 소켓 처리 
  getActiveSocket(email: string): Promise<string | null>;
  setActiveSocket(email: string, socketId: string): Promise<void>;
  deleteActiveSocket(email: string, socketId: string): Promise<void>;
}