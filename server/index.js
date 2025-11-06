import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import consolasRoutes from "./consolas.routes.js";

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rutas principales
app.use("/", authRoutes);
app.use("/", consolasRoutes);

// Puerto
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
