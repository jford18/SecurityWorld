import express from "express";
import { getMenusByRol, saveRolMenus } from "../controllers/rolMenu.controller.js";

const router = express.Router();

router.get("/:rol_id", getMenusByRol);
router.post("/", saveRolMenus);

export default router;
