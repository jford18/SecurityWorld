import { Router } from "express";
import {
  createTipoIntrusion,
  deleteTipoIntrusion,
  getTipoIntrusionById,
  listTiposIntrusion,
  updateTipoIntrusion,
} from "../controllers/tipoIntrusion.controller.js";

const router = Router();

router.get("/", listTiposIntrusion);
router.get("/:id", getTipoIntrusionById);
router.post("/", createTipoIntrusion);
router.put("/:id", updateTipoIntrusion);
router.delete("/:id", deleteTipoIntrusion);

export default router;
