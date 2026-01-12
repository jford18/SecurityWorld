import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import dotenv from "dotenv";
import authRoutes from "./auth.routes.js";
import consolasRoutes from "./routes/consolas.routes.js";
import nodosRoutes from "./routes/nodos.routes.js";
import fuerzaReaccionRoutes from "./routes/fuerzaReaccion.routes.js";
import cargoRoutes from "./routes/cargo.routes.js";
import nodosSitiosRoutes from "./routes/nodosSitios.routes.js";
import medioComunicacionRoutes from "./routes/medioComunicacion.routes.js";
import personaRoutes from "./routes/persona.routes.js";
import menusRoutes from "./menus.routes.js";
import fallosRoutes from "./fallos.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import asignarClienteSitioRoutes from "./routes/asignar_cliente_sitio.routes.js";
import catalogosRoutes from "./catalogos.routes.js";
import catalogoTipoProblemaRoutes from "./routes/catalogoTipoProblema.routes.js";
import tipoIntrusionRoutes from "./routes/tipoIntrusion.routes.js";
import intrusionesRoutes from "./routes/intrusiones.routes.js";
import rolesRoutes from "./roles.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import usuarioRolesRoutes from "./routes/usuarioRoles.routes.js";
import usuariosRolesExportPublicRoutes from "./routes/usuariosRolesExportPublic.routes.js";
import rolMenuRoutes from "./routes/rolMenu.js";
import menuRoutes from "./routes/menu.routes.js";
import proveedoresRoutes from "./routes/proveedores.routes.js";
import sitiosRoutes from "./routes/sitios.routes.js";
import haciendasRoutes from "./routes/haciendas.routes.js";
import tipoAreaRoutes from "./routes/tipoArea.routes.js";
import departamentosResponsablesRoutes from "./routes/departamentosResponsables.routes.js";
import conclusionEventoRoutes from "./routes/conclusionEvento.routes.js";
import reportesEventosRoutes from "./routes/reportesEventos.routes.js";
import reporteLogeosTurnosRoutes from "./routes/reporteLogeosTurnos.routes.js";
import tipoServicioRoutes from "./routes/tipoServicio.routes.js";
import catalogoTipoEquipoAfectadoRoutes from "./routes/catalogoTipoEquipoAfectadoRoutes.js";
import fallosTecnicosRoutes from "./routes/fallosTecnicosRoutes.js";
import hikAlarmInputStatusRoutes from "./routes/hikAlarmInputStatus.routes.js";
import hikEncodingDevicesRoutes from "./routes/hikEncodingDevices.routes.js";
import hikCamarasRoutes from "./routes/hikCamaras.routes.js";
import dashboardUptimeCamarasRoutes from "./routes/dashboardUptimeCamaras.routes.js";
import dashboardFallosTecnicosRoutes from "./routes/dashboardFallosTecnicos.routes.js";

dotenv.config();

const env = process.env;

const app = express();
app.set("etag", false);
app.use(express.json());

app.use(cors());

const knownApiPrefixes = [
  "/api/menus",
  "/api/v1/catalogo-tipo-problema",
  "/api/tipo-intrusion",
  "/api/intrusiones",
  "/api/catalogos",
  "/api/catalogo-tipo-equipo-afectado",
  "/api/auth",
  "/api/fallos-tecnicos",
  "/api/asignar-cliente-sitio",
  "/api/fallos",
  "/api/consolas",
  "/api/login",
  "/api/nodos",
  "/api/conclusion-evento",
  "/api/fuerza-reaccion",
  "/api/cargo",
  "/api/persona",
  "/api/medio-comunicacion",
  "/api/clientes",
  "/api/proveedores",
  "/api/nodos-sitios",
  "/api/rol-menu",
  "/api/roles",
  "/api/sitios",
  "/api/usuario-roles",
  "/api/usuarios-roles/export-excel-public",
  "/api/usuarios",
  "/api/haciendas",
  "/api/tipo-area",
  "/api/reportes",
  "/api/tipos-servicio",
  "/api/v1/departamentos-responsables",
  "/api/hik",
  "/api/hikcentral",
  "/api/hik-alarm-input-status",
  "/api/dashboards",
  "/api/dashboard",
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
app.use("/api/login", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/consolas", consolasRoutes);
app.use("/api", usuariosRolesExportPublicRoutes);
app.use("/api", menusRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/nodos", nodosRoutes);
app.use("/api/conclusion-evento", conclusionEventoRoutes);
app.use("/api/fuerza-reaccion", fuerzaReaccionRoutes);
app.use("/api/cargo", cargoRoutes);
app.use("/api/persona", personaRoutes);
app.use("/api/nodos-sitios", nodosSitiosRoutes);
app.use("/api/medio-comunicacion", medioComunicacionRoutes);
app.use("/api/fallos", fallosRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/v1/catalogo-tipo-problema", catalogoTipoProblemaRoutes);
app.use("/api/tipo-intrusion", tipoIntrusionRoutes);
app.use("/api/intrusiones", intrusionesRoutes);
app.use("/api/fallos-tecnicos", fallosTecnicosRoutes);
app.use("/api", hikAlarmInputStatusRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/usuario-roles", usuarioRolesRoutes);
app.use("/api/rol-menu", rolMenuRoutes);
app.use("/api/sitios", sitiosRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/asignar-cliente-sitio", asignarClienteSitioRoutes);
app.use("/api/reportes", reportesEventosRoutes);
app.use("/api/reportes", reporteLogeosTurnosRoutes);
app.use("/api", haciendasRoutes);
app.use("/api", tipoAreaRoutes);
app.use("/api/v1/departamentos-responsables", departamentosResponsablesRoutes);
app.use("/api/tipos-servicio", tipoServicioRoutes);
app.use("/api/catalogo-tipo-equipo-afectado", catalogoTipoEquipoAfectadoRoutes);
app.use("/api/hik", hikEncodingDevicesRoutes);
app.use("/api/hikcentral", hikCamarasRoutes);
app.use("/api", dashboardUptimeCamarasRoutes);
app.use("/api", dashboardFallosTecnicosRoutes);

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
