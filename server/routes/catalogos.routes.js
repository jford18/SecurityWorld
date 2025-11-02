import express from "express";
import {
  getCatalogos,
  getDepartamentos,
  getTiposProblema,
  getTiposEquipo,
  getResponsables,
} from "../controllers/catalogos.controller.js";

const router = express.Router();

router.get("/", getCatalogos);
router.get("/tipos-problema", getTiposProblema);
router.get("/departamentos", getDepartamentos);
router.get("/tipos-equipo", getTiposEquipo);
router.get("/responsables", getResponsables);

export default router;
