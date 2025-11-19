import { Router } from "express";
import {
  createFuerzaReaccion,
  deleteFuerzaReaccion,
  getFuerzaReaccionById,
  listFuerzasReaccion,
  updateFuerzaReaccion,
} from "../controllers/fuerzaReaccion.controller.js";

const router = Router();

router.get("/", listFuerzasReaccion);
router.get("/:id", getFuerzaReaccionById);
router.post("/", createFuerzaReaccion);
router.put("/:id", updateFuerzaReaccion);
router.delete("/:id", deleteFuerzaReaccion);

export default router;
