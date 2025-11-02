import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "123456",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "SecurityWorld",
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
});

pool.on("error", (err) => {
  console.error("Error inesperado en el pool:", err);
});

export default pool;
export { pool };
