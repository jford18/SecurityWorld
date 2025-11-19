import express from "express";
import {
  createCliente,
  deleteCliente,
  getClientes,
  getPersonasByCliente,
  addPersonaToCliente,
  removePersonaFromCliente,
  updateCliente,
} from "../controllers/clientes.controller.js";

const router = express.Router();

router.get("/", getClientes);
router.post("/", createCliente);
router.put("/:id", updateCliente);
router.delete("/:id", deleteCliente);
router.get("/:clienteId/personas", getPersonasByCliente);
router.post("/:clienteId/personas", addPersonaToCliente);
router.delete("/:clienteId/personas/:personaId", removePersonaFromCliente);

export default router;
