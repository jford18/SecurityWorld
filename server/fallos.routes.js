import { Router } from "express";
import {
  getFallos,
  createFallo,
  actualizarFalloSupervisor,
  getDuracionFallo,
  getHistorialFallo,
  eliminarFalloTecnico,
} from "./fallos.controller.js";

const router = Router();

router.get("/", getFallos);
router.post("/", createFallo);
router.get("/:id/duracion", getDuracionFallo);
router.get("/:id/historial", getHistorialFallo);
router.put("/:id", actualizarFalloSupervisor);
router.delete("/:id", eliminarFalloTecnico);

export default router;
