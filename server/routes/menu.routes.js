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

router.get("/", listMenus);
router.get("/authorized", verifyToken, getMenusByRole);
router.get("/:id", getMenuById);
router.post("/", createMenu);
router.put("/:id", updateMenu);
router.delete("/:id", deleteMenu);

export default router;
