import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
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

const logRoutes = (stack) => {
  stack
    .filter((layer) => layer.route || (layer.name === "router" && layer.handle?.stack))
    .forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods);
        methods.forEach((method) => {
          console.log(method.toUpperCase(), layer.route.path);
        });
      }
      if (layer.name === "router" && layer.handle?.stack) {
        logRoutes(layer.handle.stack);
      }
    });
};

console.log("🔍 Rutas activas:");
const registeredRoutes = app._router?.stack ?? [];
if (registeredRoutes.length === 0) {
  console.log("(sin rutas registradas)");
} else {
  logRoutes(registeredRoutes);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expectedRouteFiles = [
  { label: "catalogos.routes.js", file: "catalogos.routes.js" },
  { label: "fallos.routes.js", file: "fallos.routes.js" },
  { label: "management.routes.js", file: "management.routes.js" },
];

console.log("\n🔎 Verificación de archivos de rutas esperados:");
expectedRouteFiles.forEach(({ label, file }) => {
  const filePath = path.join(__dirname, file);
  if (existsSync(filePath)) {
    console.log(`✅ Encontrado: ${label}`);
  } else {
    console.log(`❌ No encontrado: ${label}`);
  }
});

// Puerto
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
