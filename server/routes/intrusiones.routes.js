import { Router } from "express";
import {
  listIntrusiones,
  createIntrusion,
  updateIntrusion,
} from "../controllers/intrusiones.controller.js";

const router = Router();

router.get("/", listIntrusiones);
router.post("/", createIntrusion);
router.put("/:id", updateIntrusion);

export default router;
