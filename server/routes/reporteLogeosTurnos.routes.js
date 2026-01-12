import { Router } from "express";
import {
  exportReporteLogeosTurnosExcel,
  getReporteLogeosTurnos,
} from "../controllers/reporteLogeosTurnos.controller.js";

const router = Router();

router.get("/logeos-turnos", getReporteLogeosTurnos);
router.get("/logeos-turnos/export", exportReporteLogeosTurnosExcel);

export default router;
