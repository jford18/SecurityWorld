import express from "express";
import { getDashboardUptimeCamaras } from "../controllers/dashboardUptimeCamarasController.js";
import { getDashboardUptimeCamarasManual } from "../controllers/dashboardUptimeCamarasManualController.js";

const router = express.Router();

router.get("/dashboards/uptime-camaras", getDashboardUptimeCamaras);
router.get("/dashboards/uptime-camaras-manual", getDashboardUptimeCamarasManual);

export default router;
