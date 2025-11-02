import express from "express";
import { getDispositivos } from "../controllers/dispositivos.controller.js";

const router = express.Router();

router.get("/", getDispositivos);

export default router;
