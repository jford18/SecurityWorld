import { Router } from "express";
import {
  createCargo,
  deleteCargo,
  getCargoById,
  listCargos,
  updateCargo,
} from "../controllers/cargo.controller.js";

const router = Router();

router.get("/", listCargos);
router.get("/:id", getCargoById);
router.post("/", createCargo);
router.put("/:id", updateCargo);
router.delete("/:id", deleteCargo);

export default router;
