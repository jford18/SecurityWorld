import { Router } from "express";
import { exportUsuariosRolesExcelPublic } from "../controllers/usuariosRolesExport.controller.js";

const router = Router();

router.get("/usuarios-roles/export-excel-public", exportUsuariosRolesExcelPublic);

// Ruta pública registrada en este archivo con endpoint /api/usuarios-roles/export-excel-public (componente: src/pages/admin/AsignacionRolesScreen.tsx)
export default router;
