import { Router } from "express";
import {
  createCliente,
  deleteCliente,
  getClientes,
  updateCliente,
} from "../controllers/clientes.controller.js";

const router = Router();

router.get("/", getClientes);
router.post("/", createCliente);
router.put("/:id", updateCliente);
router.delete("/:id", deleteCliente);

export default router;
