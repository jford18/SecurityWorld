import { Router } from "express";
import {
  getFallos,
  createFallo,
  actualizarFalloSupervisor,
  getDuracionFallo,
  getHistorialFallo,
  getHistorialDepartamentosFallo,
  eliminarFalloTecnico,
  guardarCambiosFallo,
  cerrarFalloTecnico,
} from "./fallos.controller.js";

const router = Router();

router.get("/", getFallos);
router.post("/", createFallo);
router.get("/:id/duracion", getDuracionFallo);
router.get("/:id/historial", getHistorialFallo);
router.get("/:id/historial-departamentos", getHistorialDepartamentosFallo);
router.patch("/:id/guardar-cambios", guardarCambiosFallo);
router.post("/:id/cerrar", cerrarFalloTecnico);
router.put("/:id", actualizarFalloSupervisor);
router.delete("/:id", eliminarFalloTecnico);

export default router;
