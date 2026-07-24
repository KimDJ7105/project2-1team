// client/src/components/AugmentBook/augmentData.ts

export interface AugmentBookItem {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const AUGMENT_BOOK: AugmentBookItem[] = [
  { id: 'sniper', name: '저격', icon: '🎯', description: '상대 돌 1개를 선택해 제거합니다.' },
  { id: 'seal_empty', name: '빈칸 봉인', icon: '🚫', description: '빈칸 하나를 선택해 2턴 동안 착수할 수 없게 합니다.' },
  { id: 'coin_flip', name: '동전 던지기', icon: '🪙', description: '자신의 돌 하나를 랜덤한 위치로 이동시킵니다.' },
  { id: 'double_coin', name: '동전이 두 개', icon: '🔀', description: '랜덤한 상대 돌과 자신의 돌 위치를 서로 바꿉니다.' },
  { id: 'chaos_party', name: '대환장 파티', icon: '🌈', description: '3턴 동안 모든 돌의 색이 계속 바뀝니다.' },
  { id: 'hidden_move', name: '숨겨진 한 수', icon: '🥷', description: '이번에 두는 돌이 1턴 동안 상대에게 보이지 않습니다.' },
  { id: 'fog_of_war', name: '전장의 안개', icon: '🌫️', description: '3턴 동안 상대가 내 돌과 인접한 칸만 볼 수 있게 합니다.' },
  { id: 'mixer', name: '믹서', icon: '🌪️', description: '지정한 칸 중심 3x3 영역의 돌을 무작위로 섞습니다.' },
  { id: 'meteor', name: '운석 충돌', icon: '☄️', description: '지정한 칸 중심 3x3 영역의 돌들을 보드 전체 무작위 위치로 날립니다.' },
  { id: 'different_game', name: '다른 게임', icon: '🧩', description: '내 돌로 둘러싸여 숨구멍이 없는 상대 돌 그룹을 제거합니다.' },
  { id: 'peek', name: '엿보기', icon: '👁️', description: '상대가 보유한 미사용 증강 하나를 몰래 확인합니다.' },
  { id: 'confiscate', name: '몰수', icon: '🔒', description: '상대가 보유한 미사용 증강 하나를 압수해 사용하지 못하게 합니다.' },
  { id: 'steal', name: '도둑질', icon: '🦹', description: '상대의 미사용 증강 하나를 훔쳐서 대신 사용합니다.' },
  { id: 'bombardment', name: '폭격', icon: '💣', description: '무작위 빈칸 5곳에 무작위 색의 돌을 배치합니다.' },
  { id: 'table_flip', name: '판 뒤엎기', icon: '🌀', description: '보드 위 모든 돌의 위치를 무작위로 섞습니다.' },
  { id: 'undo', name: '무르기', icon: '⏪', description: '직전에 놓인 흑돌과 백돌을 각각 제거해 한 턴 되돌립니다.' },
];