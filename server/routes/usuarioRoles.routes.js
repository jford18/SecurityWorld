import { Router } from "express";
import {
  asignarRolAUsuario,
  eliminarRolDeUsuario,
  getUsuarioRoles,
  getUsuarioRolesByUsuario,
} from "../controllers/usuarioRoles.controller.js";

// NEW: Router dedicado a la asignación de roles entre usuarios y roles del sistema.
const router = Router();

// NEW: Lista todos los usuarios con los roles asociados respetando JSON limpio.
router.get("/", getUsuarioRoles);

// NEW: Lista únicamente los roles del usuario indicado.
router.get("/:usuario_id", getUsuarioRolesByUsuario);

// NEW: Crea una asignación usuario-rol con las validaciones solicitadas.
router.post("/", asignarRolAUsuario);

// NEW: Elimina una asignación puntual verificando que exista previamente.
router.delete("/:usuario_id/:rol_id", eliminarRolDeUsuario);

export default router;
