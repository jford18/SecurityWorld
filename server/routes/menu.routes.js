import { Router } from "express";
import {
  createMenu,
  deleteMenu,
  getMenus,
  getMenusByRole,
  updateMenu,
} from "../controllers/menu.controller.js";
import verifyToken from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, getMenusByRole);
router.get("/management", verifyToken, getMenus);
router.post("/", verifyToken, createMenu);
router.put("/:id", verifyToken, updateMenu);
router.delete("/:id", verifyToken, deleteMenu);

export default router;
