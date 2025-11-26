import { Router } from "express";
import {
  createConsola,
  deleteConsola,
  getConsolaById,
  getConsolas,
  updateConsola,
} from "../controllers/consolas.controller.js";

const router = Router();

router.get("/", getConsolas);
router.get("/:id", getConsolaById);
router.post("/", createConsola);
router.put("/:id", updateConsola);
router.delete("/:id", deleteConsola);

export default router;
