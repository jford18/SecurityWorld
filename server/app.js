import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import fallosRoutes from "./fallos.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import asignarClienteSitioRoutes from "./routes/asignar_cliente_sitio.routes.js";
import tipoAreaRoutes from "./routes/tipoArea.routes.js";
import departamentosResponsablesRoutes from "./routes/departamentosResponsables.routes.js";
import catalogoTipoProblemaRoutes from "./routes/catalogoTipoProblema.routes.js";
import conclusionEventoRoutes from "./routes/conclusionEvento.routes.js";

const app = express();

const env = process.env;

const CLIENT_URL = env.CLIENT_URL;

// ✅ Configuración CORS para permitir el frontend de Vite durante el desarrollo.
const allowedOrigin = CLIENT_URL;

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
app.use("/api/clientes", clientesRoutes);
app.use("/api/fallos", fallosRoutes);
app.use("/api/asignar-cliente-sitio", asignarClienteSitioRoutes);
app.use("/api", tipoAreaRoutes);
app.use("/api/v1/catalogo-tipo-problema", catalogoTipoProblemaRoutes);
app.use("/api/v1/departamentos-responsables", departamentosResponsablesRoutes);
app.use("/api/conclusion-evento", conclusionEventoRoutes);

export default app;
