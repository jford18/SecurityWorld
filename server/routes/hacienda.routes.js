import { Router } from "express";
import {
  getHaciendas,
  getHacienda,
  createHacienda,
  updateHacienda,
  deleteHacienda,
} from "../controllers/hacienda.controller.js";

const router = Router();

router.get("/", getHaciendas);
router.get("/:id", getHacienda);
router.post("/", createHacienda);
router.put("/:id", updateHacienda);
router.delete("/:id", deleteHacienda);

export default router;
