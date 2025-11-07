import express from "express";
import { getMenus } from "./menus.controller.js";

const router = express.Router();

router.get("/api/menus", getMenus);

export default router;
