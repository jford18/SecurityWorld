import { Router } from "express";
import { getCatalogos } from "./fallos.controller.js";

const router = Router();

router.get("/", getCatalogos);

export default router;
