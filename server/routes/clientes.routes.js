import express from "express";
import { getClientes } from "../controllers/clientes.controller.js";

const router = express.Router();

router.get("/", getClientes);

export default router;
