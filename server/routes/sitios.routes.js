import express from "express";
import { getSitios } from "../controllers/sitios.controller.js";

const router = express.Router();

router.get("/", getSitios);

export default router;
