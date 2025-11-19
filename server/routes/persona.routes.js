import { Router } from "express";
import {
  createPersona,
  deletePersona,
  getPersonaById,
  getPersonasDisponiblesParaCliente,
  listPersonas,
  updatePersona,
} from "../controllers/persona.controller.js";

const router = Router();

router.get("/", listPersonas);
router.get(
  "/disponibles-para-cliente/:clienteId",
  getPersonasDisponiblesParaCliente
);
router.get("/:id", getPersonaById);
router.post("/", createPersona);
router.put("/:id", updatePersona);
router.delete("/:id", deletePersona);

export default router;
