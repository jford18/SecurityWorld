import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import fallosRoutes from "./fallos.routes.js";

const app = express();

// ✅ Configuración CORS para permitir el frontend de Vite durante el desarrollo.
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors({ origin: allowedOrigin, credentials: true }));

app.use(express.json());

// Rutas principales
app.use("/api/auth", authRoutes);
app.use("/api", fallosRoutes);

export default app;
