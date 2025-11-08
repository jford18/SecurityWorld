import express from "express";
import { getCatalogoTipoProblema } from "../controllers/catalogoTipoProblema.controller.js";

const router = express.Router();

router.get("/", getCatalogoTipoProblema);

export default router;
