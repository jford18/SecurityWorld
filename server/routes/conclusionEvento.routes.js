import { Router } from "express";
import {
  createConclusionEvento,
  deleteConclusionEvento,
  getConclusionEventoById,
  listConclusionesEvento,
  updateConclusionEvento,
} from "../controllers/conclusionEvento.controller.js";

const router = Router();

router.get("/", listConclusionesEvento);
router.get("/:id", getConclusionEventoById);
router.post("/", createConclusionEvento);
router.put("/:id", updateConclusionEvento);
router.delete("/:id", deleteConclusionEvento);

export default router;
