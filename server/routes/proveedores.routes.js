import express from "express";
import {
  createProveedor,
  deleteProveedor,
  getProveedorById,
  getProveedores,
  updateProveedor,
} from "../controllers/proveedores.controller.js";

const router = express.Router();

router.get("/", getProveedores);
router.get("/:id", getProveedorById);
router.post("/", createProveedor);
router.put("/:id", updateProveedor);
router.delete("/:id", deleteProveedor);

export default router;
