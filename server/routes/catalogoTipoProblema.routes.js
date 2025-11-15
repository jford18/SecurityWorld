import { Router } from "express";
import {
  createCatalogoTipoProblema,
  deleteCatalogoTipoProblema,
  getCatalogoTipoProblemaById,
  getCatalogoTiposProblema,
  updateCatalogoTipoProblema,
} from "../controllers/catalogoTipoProblema.controller.js";

const router = Router();

router.get("/", getCatalogoTiposProblema);
router.get("/:id", getCatalogoTipoProblemaById);
router.post("/", createCatalogoTipoProblema);
router.put("/:id", updateCatalogoTipoProblema);
router.delete("/:id", deleteCatalogoTipoProblema);

export default router;
