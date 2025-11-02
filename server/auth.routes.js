import { Router } from "express";
import {
  getMenusByRol,
  getUserConsoles,
  loginUser,
} from "./auth.controller.js";

const router = Router();

router.post("/login", loginUser);
router.get("/consolas/:usuario_id", getUserConsoles);
router.get("/menus/:rol_id", getMenusByRol);

export default router;
