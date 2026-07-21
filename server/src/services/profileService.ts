import { userRepository, userStateRepository } from '../repositories';


export class ProfileService {

  async getProfile(userId: number) {

    // 1. User 조회
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }


    // 2. UserState 조회
    const userState =
      await userStateRepository.findByUserId(userId);


    // 3. 전적 데이터가 아직 없는 경우
    if (!userState) {

      return {
        nickname: user.nickname,
        profileImage: user.profileImage,

        totalGames: 0,
        winCount: 0,
        loseCount: 0,
        drawCount: 0,

        rating: 1200,
        winRate: 0
      };

    }


    // 4. 승률 계산
    const winRate =
      userState.totalGames === 0
        ? 0
        : Number(
            (
              (userState.winCount /
                userState.totalGames) *
              100
            ).toFixed(1)
          );


    // 5. 최종 프로필 반환
    return {

      nickname: user.nickname,
      profileImage: user.profileImage,

      totalGames: userState.totalGames,
      winCount: userState.winCount,
      loseCount: userState.loseCount,
      drawCount: userState.drawCount,

      rating: userState.rating,
      winRate

    };

  }
   async updateNickname(
    userId: number,
    nickname: string
  ) {

    if (!nickname) {
      throw new Error('NICKNAME_REQUIRED');
    }


    const user =
      await userRepository.findById(userId);


    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }


    const updatedUser =
      await userRepository.update(
        userId,
        {
          nickname
        }
      );


    return {
      nickname: updatedUser.nickname
    };

  }

}


export const profileService = new ProfileService();