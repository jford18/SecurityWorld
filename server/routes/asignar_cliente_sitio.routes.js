import express from "express";
import {
  getSitiosClientes,
  asignarClienteSitio,
} from "../controllers/asignar_cliente_sitio.controller.js";

const router = express.Router();

router.get("/", getSitiosClientes);
router.post("/", asignarClienteSitio);

export default router;
