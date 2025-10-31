import { Router } from "express";
import { getUserConsoles, loginUser } from "./auth.controller.js";

const router = Router();

router.post("/login", loginUser);
router.get("/consolas/:usuario_id", getUserConsoles);

export default router;
