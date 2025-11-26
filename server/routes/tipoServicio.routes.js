import { Router } from "express";
import {
  createTipoServicio,
  getAllTipoServicio,
  getTipoServicioById,
  toggleActivoTipoServicio,
  updateTipoServicio,
} from "../controllers/tipoServicio.controller.js";

const router = Router();

router.get("/", getAllTipoServicio);
router.get("/:id", getTipoServicioById);
router.post("/", createTipoServicio);
router.put("/:id", updateTipoServicio);
router.patch("/:id/activo", toggleActivoTipoServicio);

export default router;
