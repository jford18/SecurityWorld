import { Router } from "express";
import {
  createNodo,
  deleteNodo,
  getNodoById,
  listNodos,
  updateNodo,
} from "../controllers/nodos.controller.js";

const router = Router();

router.get("/", listNodos);
router.get("/:id", getNodoById);
router.post("/", createNodo);
router.put("/:id", updateNodo);
router.delete("/:id", deleteNodo);

export default router;
