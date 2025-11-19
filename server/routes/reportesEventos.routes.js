import { Router } from "express";
import { getInformeMensualEventos } from "../controllers/reportesEventos.controller.js";

const router = Router();

router.get("/eventos-mensual", getInformeMensualEventos);

export default router;
