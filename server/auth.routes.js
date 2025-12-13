import express from "express";
import { changeOwnPassword, loginUser } from "./auth.controller.js";
import verifyToken from "./middlewares/auth.middleware.js";

const router = express.Router();

// Ruta de login
router.post("/", loginUser);
router.post("/cambiar-clave", verifyToken, changeOwnPassword);

export default router;
