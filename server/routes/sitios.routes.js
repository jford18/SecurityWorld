import { Router } from "express";
import {
  createSitio,
  deleteSitio,
  getSitioById,
  getSitios,
  updateSitio,
} from "../controllers/sitios.controller.js";

const router = Router();

router.get("/", getSitios);
router.get("/:id", getSitioById);
router.post("/", createSitio);
router.put("/:id", updateSitio);
router.delete("/:id", deleteSitio);

export default router;
