import express from "express";
import { getMenus } from "./menus.controller.js";

const router = express.Router();

router.get("/menus", (req, res, next) => {
  const usuarioId = req.user?.usuario_id || req.query.usuario_id;

  if (usuarioId) {
    return getMenus(req, res);
  }

  return next("router");
});

export default router;
