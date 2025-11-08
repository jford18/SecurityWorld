import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import authRoutes from "./auth.routes.js";
import consolasRoutes from "./consolas.routes.js";
import menusRoutes from "./menus.routes.js";
import fallosRoutes from "./fallos.routes.js";
import catalogosRoutes from "./catalogos.routes.js";
import rolesRoutes from "./roles.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import usuarioRolesRoutes from "./routes/usuarioRoles.routes.js";
import rolMenuRoutes from "./routes/rolMenu.js";

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

const knownApiPrefixes = [
  "/api/fallos",
  "/api/catalogos",
  "/api/usuarios",
  "/api/roles",
  "/api/usuario-roles",
  "/api/rol-menu",
];

app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  const shouldWarn =
    req.originalUrl.includes("/api/") &&
    !knownApiPrefixes.some((prefix) => req.originalUrl.startsWith(prefix));
  if (shouldWarn) {
    console.warn("[API][ALERTA] Endpoint incorrecto detectado:", req.originalUrl);
  }
  const candidateRole =
    (req.user && typeof req.user === "object" ? req.user.rol_id ?? req.user.role_id : null) ??
    req.headers["x-role-id"] ??
    req.headers["x-rol-id"] ??
    req.query?.rol_id ??
    req.query?.role_id;

  if (candidateRole !== undefined && candidateRole !== null && candidateRole !== "") {
    const parsedRole = Number(candidateRole);
    if (Number.isFinite(parsedRole) && parsedRole > 0) {
      const baseUser = req.user && typeof req.user === "object" ? req.user : {};
      req.user = { ...baseUser, rol_id: parsedRole };
    }
  }
  next();
});

// Rutas principales
app.use("/", authRoutes);
app.use("/", consolasRoutes);
app.use("/", menusRoutes);
app.use("/api/fallos", fallosRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/usuario-roles", usuarioRolesRoutes);
app.use("/api/rol-menu", rolMenuRoutes);

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
