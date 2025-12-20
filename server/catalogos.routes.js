import { Router } from "express";
import { getCatalogos } from "./fallos.controller.js";
import { getCamarasPorSitio } from "./controllers/camarasPorSitio.controller.js";

const router = Router();

router.get("/", getCatalogos);
router.get("/camaras-por-sitio/:sitioId", getCamarasPorSitio);

export default router;
