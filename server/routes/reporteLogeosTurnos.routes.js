import { Router } from "express";
import { getReporteLogeosTurnos } from "../controllers/reporteLogeosTurnos.controller.js";

const router = Router();

router.get("/logeos-turnos", getReporteLogeosTurnos);

export default router;
