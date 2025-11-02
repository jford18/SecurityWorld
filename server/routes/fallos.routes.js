import express from "express";
import {
  getFallos,
  getFallo,
  createFallo,
  updateFallo,
  deleteFallo,
} from "../controllers/fallos.controller.js";

const router = express.Router();

router.get("/", getFallos);
router.get("/:id", getFallo);
router.post("/", createFallo);
router.put("/:id", updateFallo);
router.delete("/:id", deleteFallo);

export default router;
