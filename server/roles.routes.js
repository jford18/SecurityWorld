// NEW: Rutas para el mantenimiento de roles.
import { Router } from "express";
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from "./roles.controller.js";

// NEW: Configuración del router específico para roles.
const router = Router();

// NEW: Endpoint para obtener todos los roles.
router.get("/", getRoles);

// NEW: Endpoint para crear un nuevo rol.
router.post("/", createRole);

// NEW: Endpoint para actualizar un rol existente.
router.put("/:id", updateRole);

// NEW: Endpoint para eliminar un rol sin asociaciones.
router.delete("/:id", deleteRole);

export default router;
