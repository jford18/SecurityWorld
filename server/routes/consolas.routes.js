import { Router } from "express";
import {
  createConsola,
  deleteConsola,
  getConsolas,
  updateConsola,
} from "../controllers/consolas.controller.js";

const router = Router();

// FIX: Centraliza el prefijo /api/consolas en un enrutador dedicado para evitar respuestas 404 o formatos incorrectos.

// NEW: Ruta GET /api/consolas para listar consolas con respuesta JSON.
router.get("/", getConsolas);

// NEW: Ruta POST /api/consolas con validaciones de nombre obligatorio y duplicados.
router.post("/", createConsola);

// NEW: Ruta PUT /api/consolas/:id para actualizar únicamente el nombre de la consola.
router.put("/:id", updateConsola);

// NEW: Ruta DELETE /api/consolas/:id que responde siempre en formato JSON.
router.delete("/:id", deleteConsola);

export default router;
