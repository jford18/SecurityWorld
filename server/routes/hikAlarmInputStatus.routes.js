import { Router } from "express";
import { getAlarmInputStatusBySite } from "../controllers/fallosTecnicosController.js";

const router = Router();

router.get("/hik-alarm-input-status", getAlarmInputStatusBySite);

export default router;
