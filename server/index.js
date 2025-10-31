import fs from "fs";
import path from "path";
import app from "./app.js";
// NEW: Incorporamos las rutas de roles al servidor principal.
import rolesRoutes from "./roles.routes.js";
import consolasRoutes from "./routes/consolas.routes.js";
// NEW: Registro del mantenimiento de usuarios en el servidor API.
import usuariosRoutes from "./routes/usuarios.routes.js";
// NEW: Registro del catálogo de tipos de problema en el servidor API.
import catalogoTipoProblemaRoutes from "./routes/catalogoTipoProblema.routes.js";

// NEW: Registro del módulo de asignación de roles a usuarios siguiendo la convención /api/usuario-roles.
import usuarioRolesRoutes from "./routes/usuarioRoles.routes.js";


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

// NEW: Registro del módulo de mantenimiento de roles.
app.use("/api/roles", rolesRoutes);
app.use("/api/consolas", consolasRoutes);
// NEW: Registro del módulo de usuarios siguiendo la convención /api/usuarios.
app.use("/api/usuarios", usuariosRoutes);
// NEW: Registro del módulo de catálogo tipo problema en la ruta /api/catalogo-tipo-problema.
app.use("/api/catalogo-tipo-problema", catalogoTipoProblemaRoutes);

// NEW: Registro del módulo encargado de asignar roles a los usuarios.
app.use("/api/usuario-roles", usuarioRolesRoutes);


app.use((req, res) => {
  res.setHeader("Content-Type", "application/json"); // FIX: Middleware de 404 con respuesta JSON.
  res.status(404).json({ message: "Ruta no encontrada" });
});


app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
