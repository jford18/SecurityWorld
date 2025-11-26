import { Router } from "express";
import {
  createTipoServicio,
  getAllTipoServicio,
  getTipoServicioById,
  toggleActivoTipoServicio,
  updateTipoServicio,
} from "../controllers/tipoServicio.controller.js";
import verifyToken from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, getAllTipoServicio);
router.get("/:id", verifyToken, getTipoServicioById);
router.post("/", verifyToken, createTipoServicio);
router.put("/:id", verifyToken, updateTipoServicio);
router.patch("/:id/activo", verifyToken, toggleActivoTipoServicio);

export default router;
