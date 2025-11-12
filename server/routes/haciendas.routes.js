// routes/haciendas.routes.js
import express from "express";
import { getHaciendas } from "../controllers/haciendas.controller.js";
const router = express.Router();
router.get("/", getHaciendas);
export default router;
