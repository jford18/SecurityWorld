import express from "express";
const router = express.Router();

// Evita alerta por endpoint incorrecto
router.get("/:id", (req, res) => {
  const { id } = req.params;
  console.log(`[API] GET /api/rol-menu/${id} — manejado correctamente`);
  // Puedes devolver algo simple o vacío
  res.status(200).json({
    message: `Endpoint rol-menu operativo. Rol ID: ${id}`,
    data: [],
  });
});

export default router;
