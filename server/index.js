import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import consolasRoutes from "./consolas.routes.js";
import menusRoutes from "./menus.routes.js";

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
app.use("/", menusRoutes);

console.log("Rutas registradas:");
const registeredRoutes = app._router?.stack ?? [];
if (registeredRoutes.length === 0) {
  console.log("(sin rutas registradas)");
} else {
  registeredRoutes
    .filter((layer) => layer.route)
    .forEach((layer) => {
      const method = Object.keys(layer.route.methods)[0] || "";
      console.log(method.toUpperCase(), layer.route.path);
    });
}

// Puerto
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
