import express from "express";
import { getAllConsolas } from "./consolas.controller.js";

const router = express.Router();
router.get("/consolas", getAllConsolas);

export default router;
