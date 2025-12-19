import { Router } from "express";
import { getCamarasPorSitio, getCatalogos } from "./fallos.controller.js";

const router = Router();

router.get("/", getCatalogos);
router.get("/camaras-por-sitio/:sitioId", getCamarasPorSitio);

export default router;
