import { Router } from "express";
import {
  getFallos,
  createFallo,
  actualizarFalloSupervisor,
  getDuracionFallo,
  getHistorialFallo,
  eliminarFalloTecnico,
  guardarCambiosFallo,
  cerrarFalloTecnico,
} from "./fallos.controller.js";
import verifyToken from "./middlewares/auth.middleware.js";

const router = Router();

router.get("/", getFallos);
router.post("/", verifyToken, createFallo);
router.get("/:id/duracion", getDuracionFallo);
router.get("/:id/historial", getHistorialFallo);
router.patch("/:id/guardar-cambios", guardarCambiosFallo);
router.post("/:id/cerrar", cerrarFalloTecnico);
router.put("/:id", actualizarFalloSupervisor);
router.delete("/:id", eliminarFalloTecnico);

export default router;
