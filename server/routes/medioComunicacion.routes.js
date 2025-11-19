import { Router } from "express";
import {
  createMedioComunicacion,
  deleteMedioComunicacion,
  getMedioComunicacionById,
  listMediosComunicacion,
  updateMedioComunicacion,
} from "../controllers/medioComunicacion.controller.js";

const router = Router();

router.get("/", listMediosComunicacion);
router.get("/:id", getMedioComunicacionById);
router.post("/", createMedioComunicacion);
router.put("/:id", updateMedioComunicacion);
router.delete("/:id", deleteMedioComunicacion);

export default router;
