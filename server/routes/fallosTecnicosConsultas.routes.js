import { Router } from "express";
import { exportFallosTecnicosConsultasExcel } from "../fallos.controller.js";

const router = Router();

router.get("/fallos-tecnicos-consultas/export-excel", exportFallosTecnicosConsultasExcel);

export default router;
