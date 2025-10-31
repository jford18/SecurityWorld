import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import fallosRoutes from "./fallos.routes.js";

const app = express();

// ✅ Configuración CORS corregida
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Rutas principales
app.use("/api/auth", authRoutes);
app.use("/api", fallosRoutes);

export default app;
