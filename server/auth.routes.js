import express from "express";
import { loginUser } from "./auth.controller.js";

const router = express.Router();

// Ruta de login
router.post("/", loginUser);

export default router;
