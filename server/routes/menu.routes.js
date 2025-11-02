import { Router } from "express";
import {
  createMenu,
  deleteMenu,
  getMenus,
  updateMenu,
} from "../controllers/menu.controller.js";

const router = Router();

router.get("/", getMenus);
router.post("/", createMenu);
router.put("/:id", updateMenu);
router.delete("/:id", deleteMenu);

export default router;
