import { Router } from "express";
import { getCamarasPorSitio } from "../controllers/camarasPorSitio.controller.js";

const router = Router();

router.get("/camaras", getCamarasPorSitio);
router.get("/camaras/by-sitio/:sitioId", getCamarasPorSitio);

export default router;
