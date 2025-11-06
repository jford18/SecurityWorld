import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import consolasRoutes from "./consolas.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Rutas principales
app.use("/", authRoutes);
app.use("/", consolasRoutes);

// Puerto
app.listen(4000, () => console.log("✅ Servidor corriendo en puerto 4000"));
