import { Router } from "express";
import {
  listIntrusiones,
  createIntrusion,
  updateIntrusion,
  deleteIntrusion,
  getConsolidadoIntrusiones,
  exportConsolidadoIntrusiones,
  getEventosPorHaciendaSitio,
} from "../controllers/intrusiones.controller.js";

const router = Router();

router.get("/", listIntrusiones);
router.get("/consolidado/export", exportConsolidadoIntrusiones);
router.get("/consolidado", getConsolidadoIntrusiones);
router.get("/eventos-por-hacienda-sitio", getEventosPorHaciendaSitio);
router.post("/", createIntrusion);
router.put("/:id", updateIntrusion);
router.delete("/:id", deleteIntrusion);

export default router;
