import {
  GameRecordDetail,
  GameRecordList,
} from "../repositories/gameRecordRepository";

import { gameRecordRepositoryImpl } from "../repositories/mysqlGameRecordRepository";


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

    return await gameRecordRepositoryImpl.findByGameId(gameId);

  }

}


export const gameRecordService = new GameRecordService();