// src/shared/data/augments.ts

export type AugmentType = 'IMMEDIATE' | 'TARGET_SELECT' | 'DURATION';

export interface IAugment {
  id: string;
  name: string;
  description: string;
  type: AugmentType;
}

export class Augment implements IAugment {
  id: string;
  name: string;
  description: string;
  type: AugmentType;

  constructor(id: string, name: string, description: string, type: AugmentType) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.type = type;
  }
}

export const AUGMENT_LIST: Augment[] = [
  new Augment('sniper', '저격', '상대 돌 1개 선택해 제거 (게임당 1회, 최근에 둔 돌 제거 불가)', 'TARGET_SELECT'),
  new Augment('seal_empty', '빈칸 봉인', '빈칸 하나 선택 시 다음 3턴 동안 누구도 그 칸에 돌을 둘 수 없게 합니다.', 'TARGET_SELECT'),
  new Augment('coin_flip', '동전 던지기', '자신의 돌 하나를 랜덤한 위치로 이동시킵니다.', 'IMMEDIATE'),
  new Augment('double_coin', '동전이 두개', '랜덤한 상대 돌과 랜덤한 자신의 돌 위치를 바꿉니다.', 'IMMEDIATE'),
  new Augment('chaos_party', '대환장 파티', '3턴 동안 모든 돌의 색을 변화시킵니다. ', 'DURATION'),
  new Augment('hidden_move', '숨겨진 한 수', '이번 턴에 둔 돌이 1턴 동안 상대에게 안 보입니다.', 'DURATION'),
  new Augment('fog_of_war', '전장의 안개', '3턴 동안 상대가 자신의 돌과 인접한 칸만 보이도록 합니다.', 'DURATION'),
  new Augment('mixer', '믹서', '3x3 칸 내의 바둑알을 무작위로 섞습니다.', 'TARGET_SELECT'),
  new Augment('meteor', '운석 충돌', '3x3 칸 내의 모든 바둑알을 무작위 위치로 이동시킵니다.', 'TARGET_SELECT'),
  new Augment('different_game', '그건 다른 게임이야', '자신의 돌로 둘러진 영역에 있는 상대 돌을 제거합니다.', 'IMMEDIATE'),
  new Augment('peek', '훔쳐보기', '상대의 증강 1개를 확인합니다.', 'TARGET_SELECT'),
  new Augment('confiscate', '압수', '상대의 증강 1개를 사용 상태로 만듭니다.', 'TARGET_SELECT'),
  new Augment('steal', '도둑질', '상대 증강 1개를 대신 사용합니다.', 'TARGET_SELECT'),
  new Augment('bombardment', '폭격', '랜덤한 위치에 랜덤한 돌 5개를 둡니다.', 'IMMEDIATE'),
  new Augment('table_flip', '밥상 엎기', '모든 돌 위치를 랜덤한 위치로 이동시킵니다.', 'IMMEDIATE'),
  new Augment('undo', '물러줘', '이전 내 턴으로 돌아갑니다. (이전 턴 상대 돌과 내 돌 제거)', 'IMMEDIATE'),
];

export const AUGMENT_MAP: Map<string, Augment> = new Map(
  AUGMENT_LIST.map((augment) => [augment.id, augment])
);