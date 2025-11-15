import { Router } from "express";
import {
  getFallos,
  createFallo,
  actualizarFalloSupervisor,
} from "./fallos.controller.js";

const router = Router();

router.get("/", getFallos);
router.post("/", createFallo);
router.put("/:id", actualizarFalloSupervisor);

export default router;
