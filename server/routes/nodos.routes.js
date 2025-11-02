import express from "express";
import { getNodos } from "../controllers/nodos.controller.js";

const router = express.Router();

router.get("/", getNodos);

export default router;
