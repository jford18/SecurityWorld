import { Router } from "express";
import {
  assignSitio,
  exportAllAsignacionesNodosSitios,
  listAsignaciones,
  listSitiosByNodo,
  unassignSitio,
} from "../controllers/nodosSitios.controller.js";

const router = Router();

router.get("/", listAsignaciones);
router.get("/export-all", exportAllAsignacionesNodosSitios);
router.get("/:nodo_id", listSitiosByNodo);
router.post("/", assignSitio);
router.delete("/", unassignSitio);

export default router;
