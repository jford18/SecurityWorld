import { Router } from "express";
import {
  getFallos,
  createFallo,
  actualizarFalloSupervisor,
} from "./fallos.controller.js";
import { verifyToken } from "./middlewares/auth.middleware.js";

const router = Router();

router.get("/", getFallos);
router.post("/", createFallo);
router.put("/:id", verifyToken, actualizarFalloSupervisor);

export default router;
