import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  console.log("[API] GET /api/catalogo-tipo-problema — manejado correctamente");
  res.status(200).json([
    { id: 1, nombre: "Error de conexión", activo: true },
    { id: 2, nombre: "Falla de sensor", activo: true },
    { id: 3, nombre: "Error de cámara", activo: false },
  ]);
});

export default router;
