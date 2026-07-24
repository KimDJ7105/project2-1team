import {
  GameRecordDetail,
  GameRecordList,
} from "../repositories/gameRecordRepository";

import { gameRecordRepositoryImpl } from "../repositories/mysqlGameRecordRepository";
import { s3Service } from './s3Service';


class GameRecordService {

  // 전적 목록 조회
  async getGameRecords(
    userId: number
  ): Promise<GameRecordList[]> {

    return await gameRecordRepositoryImpl.findByUserId(userId);

  }


  // 대국 상세 조회
  async getGameRecordDetail(
    gameId: number
  ): Promise<GameRecordDetail | null> {

    const record = await gameRecordRepositoryImpl.findByGameId(gameId);
    if (!record) return null;

    // presign profile images for both players (returns null if none)
    const blackProfile = await s3Service.getProfilePresignedGetUrl((record as any).blackProfileImage as string | null);
    const whiteProfile = await s3Service.getProfilePresignedGetUrl((record as any).whiteProfileImage as string | null);

    return {
      ...record,
      blackProfileImage: blackProfile,
      whiteProfileImage: whiteProfile,
    } as GameRecordDetail;

  }

}


export const gameRecordService = new GameRecordService();