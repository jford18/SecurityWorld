import { Router } from "express";
import { loginUser } from "./auth.controller.js";

const router = Router();

router.post("/api/auth/login", loginUser);

export default router;
