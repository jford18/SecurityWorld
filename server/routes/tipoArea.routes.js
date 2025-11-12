// routes/tipo_area.routes.js
import express from "express";
import { getTipoArea } from "../controllers/tipoArea.controller.js";
const router = express.Router();
router.get("/", getTipoArea);
export default router;
