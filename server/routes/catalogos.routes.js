import express from "express";
import {
  getCatalogos,
  getDepartamentos,
  getTiposProblema,
} from "../controllers/catalogos.controller.js";

const router = express.Router();

router.get("/", getCatalogos);
router.get("/tipos-problema", getTiposProblema);
router.get("/departamentos", getDepartamentos);

export default router;
