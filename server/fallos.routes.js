import { Router } from "express";
import {
  getFallos,
  createFallo,
  updateFallo,
} from "./fallos.controller.js";
import verifyToken from "./middlewares/auth.middleware.js";

const router = Router();

router.get("/", getFallos);
router.post("/", createFallo);
router.put("/:id", verifyToken, updateFallo);

export default router;
