import fs from "fs";
import path from "path";
import app from "./app.js";
// NEW: Incorporamos las rutas de roles al servidor principal.
import rolesRoutes from "./roles.routes.js";

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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
