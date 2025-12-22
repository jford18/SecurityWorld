import express from "express";
import { changeOwnPassword, loginUser, registrarLogeo } from "./auth.controller.js";
import verifyToken from "./middlewares/auth.middleware.js";

const router = express.Router();

// Ruta de login
router.post("/", loginUser);
router.post("/cambiar-clave", verifyToken, changeOwnPassword);
router.post("/registrar-logeo", verifyToken, registrarLogeo);

export default router;
