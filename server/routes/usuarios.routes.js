import { Router } from "express";
import {
  createUsuario,
  deleteUsuario,
  getUsuarios,
  updateUsuario,
} from "../controllers/usuarios.controller.js";

const router = Router();

// NEW: Rutas REST del módulo de usuarios con manejo uniforme de JSON.
router.get("/", getUsuarios);
router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.delete("/:id", deleteUsuario);

export default router;
