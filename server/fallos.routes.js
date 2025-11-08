import { Router } from "express";
import {
  getFallos,
  createFallo,
  updateFallo,
} from "./fallos.controller.js";

const router = Router();

router.get("/", getFallos);
router.post("/", createFallo);
router.put("/:id", updateFallo);

export default router;
