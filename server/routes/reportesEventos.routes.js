import { Router } from "express";
import {
  getEventosPorSitio,
  getInformeMensualEventos,
} from "../controllers/reportesEventos.controller.js";

const router = Router();

router.get("/eventos-mensual", getInformeMensualEventos);
router.get("/informe-eventos/eventos-por-sitio", getEventosPorSitio);

export default router;
