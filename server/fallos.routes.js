import { Router } from "express";
import {
  getFallos,
  createFallo,
  updateFallo,
  getCatalogos,
} from "./fallos.controller.js";

const router = Router();

router.get("/fallos", getFallos);
router.post("/fallos", createFallo);
router.put("/fallos/:id", updateFallo);
router.get("/catalogos", getCatalogos);

export default router;
