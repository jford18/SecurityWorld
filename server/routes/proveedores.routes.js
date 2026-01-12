import express from "express";
import {
  createProveedor,
  deleteProveedor,
  exportProveedoresExcel,
  getProveedorById,
  getProveedores,
  updateProveedor,
} from "../controllers/proveedores.controller.js";

const router = express.Router();

router.get("/", getProveedores);
router.get("/export", exportProveedoresExcel);
router.get("/:id", getProveedorById);
router.post("/", createProveedor);
router.put("/:id", updateProveedor);
router.delete("/:id", deleteProveedor);

export default router;
