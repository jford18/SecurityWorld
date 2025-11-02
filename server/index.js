import fs from "fs";
import path from "path";
import app from "./app.js";
import authRoutes from "./routes/auth.routes.js";
// NEW: Incorporamos las rutas de roles al servidor principal.
import rolesRoutes from "./roles.routes.js";
import fallosRoutes from "./routes/fallos.routes.js";
import catalogosRoutes from "./routes/catalogos.routes.js";
import nodosRoutes from "./routes/nodos.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import sitiosRoutes from "./routes/sitios.routes.js";
import dispositivosRoutes from "./routes/dispositivos.routes.js";
import consolasRoutes from "./routes/consolas.routes.js";
// NEW: Registro del mantenimiento de usuarios en el servidor API.
import usuariosRoutes from "./routes/usuarios.routes.js";
// NEW: Registro del catálogo de tipos de problema en el servidor API.
import catalogoTipoProblemaRoutes from "./routes/catalogoTipoProblema.routes.js";

// NEW: Registro del módulo de asignación de roles a usuarios siguiendo la convención /api/usuario-roles.
import usuarioRolesRoutes from "./routes/usuarioRoles.routes.js";
// NEW: Registro del módulo de asignación de consolas a usuarios.
import usuarioConsolasRoutes from "./routes/usuarioConsolas.routes.js";


const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const [key, ...rest] = trimmed.split("=");
    if (!key) {
      return;
    }
    const value = rest.join("=").trim();
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

const PORT = Number(process.env.PORT) || 3000;

app.use("/api/auth", authRoutes);

// NEW: Registro del módulo de mantenimiento de roles.
app.use("/api/roles", rolesRoutes);
app.use("/api/consolas", consolasRoutes);
app.use("/api/fallos", fallosRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/nodos", nodosRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/sitios", sitiosRoutes);
app.use("/api/dispositivos", dispositivosRoutes);
// NEW: Registro del módulo de usuarios siguiendo la convención /api/usuarios.
app.use("/api/usuarios", usuariosRoutes);
// NEW: Registro del módulo de catálogo tipo problema en la ruta /api/catalogo-tipo-problema.
app.use("/api/catalogo-tipo-problema", catalogoTipoProblemaRoutes);

// NEW: Registro del módulo encargado de asignar roles a los usuarios.
app.use("/api/usuario-roles", usuarioRolesRoutes);
// NEW: Registro del módulo encargado de asignar consolas a los usuarios.
app.use("/api/usuario_consolas", usuarioConsolasRoutes);


app.use((req, res) => {
  res.status(404).json({ message: "No encontrado" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled:", err?.stack || err);
  res.status(500).json({ message: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
