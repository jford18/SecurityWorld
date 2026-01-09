import { Router } from "express";
import { getDashboardFallosTecnicosResumen } from "../controllers/dashboardFallosTecnicosController.js";

const router = Router();

router.get("/dashboard/fallos-tecnicos/resumen", getDashboardFallosTecnicosResumen);

export default router;
