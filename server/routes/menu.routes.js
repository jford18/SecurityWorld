import { Router } from "express";
import {
  createMenu,
  deleteMenu,
  getMenuById,
  getMenusByRole,
  listMenus,
  updateMenu,
} from "../controllers/menu.controller.js";
import verifyToken from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, listMenus);
router.get("/authorized", verifyToken, getMenusByRole);
router.get("/:id", verifyToken, getMenuById);
router.post("/", verifyToken, createMenu);
router.put("/:id", verifyToken, updateMenu);
router.delete("/:id", verifyToken, deleteMenu);

export default router;
