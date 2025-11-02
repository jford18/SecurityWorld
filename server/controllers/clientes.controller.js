import pool from "../config/db.js";

export const getClientes = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, nodo_id FROM clientes ORDER BY nombre"
    );

    return res.json(result.rows ?? []);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/clientes (getClientes):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los clientes." });
  }
};

export default getClientes;
