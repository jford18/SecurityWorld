import { Router } from "express";
import { getCamerasBySite } from "../controllers/fallosTecnicosController.js";

const router = Router();

router.get("/camaras/:siteName", getCamerasBySite);

export default router;

