import { Router } from "express";
import {
  listIntrusiones,
  createIntrusion,
  updateIntrusion,
  deleteIntrusion,
  getConsolidadoIntrusiones,
} from "../controllers/intrusiones.controller.js";

const router = Router();

router.get("/", listIntrusiones);
router.get("/consolidado", getConsolidadoIntrusiones);
router.post("/", createIntrusion);
router.put("/:id", updateIntrusion);
router.delete("/:id", deleteIntrusion);

export default router;
