import { Router } from "express";
import { gameRecordController } from "../controllers/gameRecordController";

const router = Router();

router.get("/", (req, res) =>
  gameRecordController.getGameRecords(req, res)
);

router.get("/:gameId", (req, res) =>
  gameRecordController.getGameRecordDetail(req, res)
);

export default router;