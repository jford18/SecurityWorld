import express from "express";
import { getDashboardUptimeCamaras } from "../controllers/dashboardUptimeCamarasController.js";

const router = express.Router();

router.get("/dashboards/uptime-camaras", getDashboardUptimeCamaras);

export default router;
