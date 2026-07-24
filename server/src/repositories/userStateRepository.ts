// server/src/repositories/userStateRepository.ts

export interface UserState {
  userId: number;

  totalGames: number;
  winCount: number;
  loseCount: number;
  drawCount: number;

  rating: number;

  updatedAt: Date;
}

export interface UserStateRepository {
  findByUserId(userId: number): Promise<UserState | null>;
   applyGameResult(
    userId: number,
    result: 'win' | 'lose' | 'draw',
    ratingChange: number
  ): Promise<UserState>;

}
