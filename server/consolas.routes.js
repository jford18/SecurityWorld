import express from "express";
import { getAllConsolas } from "./consolas.controller.js";

const router = express.Router();

// La ruta base se configura desde index.js como /api/consolas, por lo que aquí
// solo necesitamos exponer la raíz del router para que responda a
// GET /api/consolas correctamente.
router.get("/", getAllConsolas);

export default router;
