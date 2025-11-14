import express from "express";
import {
  getTipoAreas,
  getTipoAreaById,
  createTipoArea,
  updateTipoArea,
  deleteTipoArea,
} from "../controllers/tipoArea.controller.js";

const router = express.Router();

router.get("/tipo-area", getTipoAreas);
router.get("/tipo-area/:id", getTipoAreaById);
router.post("/tipo-area", createTipoArea);
router.put("/tipo-area/:id", updateTipoArea);
router.delete("/tipo-area/:id", deleteTipoArea);

export default router;
