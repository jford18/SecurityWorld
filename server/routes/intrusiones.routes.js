import { Router } from "express";
import {
  listIntrusiones,
  createIntrusion,
  updateIntrusion,
  getConsolidadoIntrusiones,
} from "../controllers/intrusiones.controller.js";

const router = Router();

router.get("/", listIntrusiones);
router.get("/consolidado", getConsolidadoIntrusiones);
router.post("/", createIntrusion);
router.put("/:id", updateIntrusion);

export default router;
