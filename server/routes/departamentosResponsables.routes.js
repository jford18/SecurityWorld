import { Router } from "express";
import {
  getAllDepartamentosResponsables,
  getDepartamentoResponsableById,
  createDepartamentoResponsable,
  updateDepartamentoResponsable,
  deleteDepartamentoResponsable,
} from "../controllers/departamentosResponsables.controller.js";

const router = Router();

router.get("/", getAllDepartamentosResponsables);
router.get("/:id", getDepartamentoResponsableById);
router.post("/", createDepartamentoResponsable);
router.put("/:id", updateDepartamentoResponsable);
router.delete("/:id", deleteDepartamentoResponsable);

export default router;
