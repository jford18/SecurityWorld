import { Router } from "express";
import { createMenu, deleteMenu, getMenuById, getMenus, updateMenu } from "../controllers/menu.controller.js";
import verifyToken from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyToken, getMenus);
router.get("/:id", verifyToken, getMenuById);
router.post("/", verifyToken, createMenu);
router.put("/:id", verifyToken, updateMenu);
router.delete("/:id", verifyToken, deleteMenu);

export default router;
