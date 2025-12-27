import { Router } from "express";
import {
  listIntrusiones,
  createIntrusion,
  updateIntrusion,
  deleteIntrusion,
  getConsolidadoIntrusiones,
  exportConsolidadoIntrusiones,
  getEventosPorHaciendaSitio,
  getEventosNoAutorizadosDashboard,
  getEventosAutorizadosDashboard,
  listIntrusionesEncoladasHc,
  openIntrusionDesdeHc,
} from "../controllers/intrusiones.controller.js";

const router = Router();

router.get("/", listIntrusiones);
router.get("/consolidado/export", exportConsolidadoIntrusiones);
router.get("/consolidado", getConsolidadoIntrusiones);
router.get("/eventos-por-hacienda-sitio", getEventosPorHaciendaSitio);
router.get("/eventos-no-autorizados/dashboard", getEventosNoAutorizadosDashboard);
router.get("/eventos-autorizados/dashboard", getEventosAutorizadosDashboard);
router.get("/encolados-hc", listIntrusionesEncoladasHc);
router.post("/hc/:hikAlarmEventoId/abrir", openIntrusionDesdeHc);
router.post("/", createIntrusion);
router.put("/:id", updateIntrusion);
router.delete("/:id", deleteIntrusion);

export default router;
