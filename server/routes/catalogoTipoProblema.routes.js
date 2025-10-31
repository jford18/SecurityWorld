// NEW: Rutas del catálogo de tipos de problema siguiendo el prefijo /api/catalogo-tipo-problema.
import { Router } from "express";
import {
  createCatalogoTipoProblema,
  deleteCatalogoTipoProblema,
  getCatalogoTiposProblema,
  updateCatalogoTipoProblema,
} from "../controllers/catalogoTipoProblema.controller.js";

const router = Router();

// FIX: Todas las rutas devuelven JSON y utilizan los verbos HTTP correctos para evitar errores previos.
router.get("/", getCatalogoTiposProblema);
router.post("/", createCatalogoTipoProblema);
router.put("/:id", updateCatalogoTipoProblema);
router.delete("/:id", deleteCatalogoTipoProblema);

export default router;
