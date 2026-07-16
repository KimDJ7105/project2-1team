// ==========================================
// [1] Client -> Server (CS) 이벤트 데이터 규격
// ==========================================

// 방 생성 요청
export interface CSCreateRoom {
  playerId: string; // 본인 ID
  nickname: string; // 본인 이름
  roomTitle: string; // 방제
}

// 특정 방 입장 요청
export interface CSJoinRoom {
  roomId: string; // 방 ID
  playerId: string; // 본인 ID
  nickname: string; // 본인 이름
}

// 로비 방 목록 조회 요청
export interface CSGetRoomList {
  playerId: string; // 본인 ID 
}

// 바둑판에 돌 놓기 요청
export interface CSPlaceStone {
  roomId: string; // 방 ID
  playerId: string; // 본인 ID
  x: number;        // x 좌표 0~14
  y: number;        // y 좌표 0~14
}


// ==========================================
// [2] Server -> Client (SC) 이벤트 데이터 규격
// ==========================================

// 방 생성 성공 응답 (방 개설자에게 전송)
export interface SCRoomCreated {
  roomId: string;   // 방 ID
  roomTitle: string; // 방 제목
}

// 방 입장 성공 응답 (방 안의 모든 플레이어에게 브로드캐스트)
export interface SCRoomJoined {
  roomId: string; // 방 ID
  roomTitle: string; // 방제
  players: {    // 플레이어 데이터 배열
    playerId: string;   // ID
    nickname: string;   // 이름
    color: 'black' | 'white'; // 흑돌 or 백돌
  }[];
  isGameStarted: boolean; // 게임 시작 여부
}

// 로비의 개설된 방 정보 요약
export interface SCRoomSummary {
  roomId: string;   // 방 ID
  roomTitle: string;    // 방제
  playerCount: number; // 플레이어 수, 1 또는 2
  status: 'waiting' | 'playing'; // 방 상태
}

// 로비 방 목록 실시간 업데이트 데이터
export type SCRoomListUpdate = SCRoomSummary[];

// 돌이 성공적으로 놓였음을 알림 (방 안의 모든 플레이어에게 브로드캐스트)
export interface SCStonePlaced {
  x: number;    // x 좌표 0~14
  y: number;    // y 좌표 0~14
  color: 'black' | 'white'; // 돌의 색
  nextTurnPlayerId: string; // 다음 차례 플레이어 ID 
}

// 게임 종료 처리 알림 (방 안의 모든 플레이어에게 브로드캐스트)
export interface SCGameOver {
  winnerId: string; // 무승부일 경우 'draw'
  reason: 'five' | 'surrender' | 'timeout'; // 승리 원인 
}