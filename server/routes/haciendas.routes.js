import express from "express";
import {
  getHaciendas,
  createHacienda,
  updateHacienda,
  deleteHacienda,
} from "../controllers/haciendas.controller.js";

const router = express.Router();

router.get("/haciendas", getHaciendas);
router.post("/haciendas", createHacienda);
router.put("/haciendas/:id", updateHacienda);
router.delete("/haciendas/:id", deleteHacienda);

export default router;