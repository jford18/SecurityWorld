import { Router } from "express";
import {
  createUsuario,
  deleteUsuario,
  exportUsuariosExcel,
  getUsuarios,
  updateUsuario,
} from "../controllers/usuarios.controller.js";

const router = Router();

// NEW: Rutas REST del módulo de usuarios con manejo uniforme de JSON.
router.get("/", getUsuarios);
router.get("/export", exportUsuariosExcel);
router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.delete("/:id", deleteUsuario);

export default router;
