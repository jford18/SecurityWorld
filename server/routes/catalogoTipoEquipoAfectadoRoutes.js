import { Router } from "express";
import {
  createCatalogoTipoEquipoAfectado,
  deleteCatalogoTipoEquipoAfectado,
  getCatalogoTipoEquipoAfectadoById,
  listCatalogoTipoEquipoAfectado,
  updateCatalogoTipoEquipoAfectado,
} from "../controllers/catalogoTipoEquipoAfectadoController.js";

const router = Router();

router.get("/", listCatalogoTipoEquipoAfectado);
router.get("/:id", getCatalogoTipoEquipoAfectadoById);
router.post("/", createCatalogoTipoEquipoAfectado);
router.put("/:id", updateCatalogoTipoEquipoAfectado);
router.delete("/:id", deleteCatalogoTipoEquipoAfectado);

export default router;
