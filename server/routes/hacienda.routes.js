import { Router } from "express";
import {
  createHacienda,
  deleteHacienda,
  getHacienda,
  listHacienda,
  updateHacienda,
} from "../controllers/hacienda.controller.js";
import verifyToken from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, listHacienda);
router.get("/:id", verifyToken, getHacienda);
router.post("/", verifyToken, createHacienda);
router.put("/:id", verifyToken, updateHacienda);
router.delete("/:id", verifyToken, deleteHacienda);

export default router;
