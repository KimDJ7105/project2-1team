import { Request, Response } from "express";
import { gameRecordService } from "../services/gameRecordService";

class GameRecordController {

  // 전적 목록 조회
  async getGameRecords(req: Request, res: Response) {

    try {

      const userId = Number(req.query.userId);

      if (!userId) {
        return res.status(400).json({
          message: "userId가 필요합니다.",
        });
      }

      const records =
        await gameRecordService.getGameRecords(userId);

      return res.json(records);

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        message: "전적 조회 실패",
      });

    }

  }

  // 대국 상세 조회
  async getGameRecordDetail(req: Request, res: Response) {

    try {

      const gameId = Number(req.params.gameId);

      const record =
        await gameRecordService.getGameRecordDetail(gameId);

      if (!record) {
        return res.status(404).json({
          message: "대국을 찾을 수 없습니다.",
        });
      }

      return res.json(record);

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        message: "대국 조회 실패",
      });

    }

  }

}

export const gameRecordController = new GameRecordController();