import db from "../config/db.js";

const pool = db;

export const getClientes = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT id, nombre, nodo_id FROM clientes ORDER BY nombre"
    );

    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener los clientes:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los clientes." });
  } finally {
    client.release();
  }
};

export default getClientes;
