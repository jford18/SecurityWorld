import db from "../config/db.js";
import {
  nodos,
  nodoCliente,
  tiposEquipo,
  tiposProblemaEquipo,
  dispositivos,
  sitiosPorConsola,
} from "../data/technicalFailureCatalogs.js";

const pool = db;

const mapUsuarios = (rows = []) =>
  rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
  }));

export const getTiposProblema = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT id, descripcion FROM catalogo_tipo_problema ORDER BY descripcion"
    );
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener los tipos de problema:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los tipos de problema." });
  } finally {
    client.release();
  }
};

export const getDepartamentos = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT id, nombre FROM departamentos_responsables ORDER BY nombre"
    );
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener los departamentos responsables:", error);
    return res
      .status(500)
      .json({
        mensaje: "Ocurrió un error al obtener los departamentos responsables.",
      });
  } finally {
    client.release();
  }
};

export const getCatalogos = async (_req, res) => {
  const client = await pool.connect();

  try {
    const [departamentosResult, tiposProblemaResult, responsablesResult] =
      await Promise.all([
        client.query(
          "SELECT id, nombre FROM departamentos_responsables ORDER BY nombre"
        ),
        client.query(
          "SELECT id, descripcion FROM catalogo_tipo_problema ORDER BY descripcion"
        ),
        client.query(`
          SELECT u.id, COALESCE(u.nombre_completo, u.nombre_usuario) AS nombre
          FROM usuarios u
          WHERE u.activo = true
          ORDER BY nombre
        `),
      ]);

    return res.json({
      departamentos: departamentosResult.rows ?? [],
      tiposProblema: tiposProblemaResult.rows ?? [],
      responsablesVerificacion: mapUsuarios(responsablesResult.rows),
      nodos,
      nodoCliente,
      tiposEquipo,
      tiposProblemaEquipo,
      dispositivos,
      sitiosPorConsola,
    });
  } catch (error) {
    console.error("Error al obtener los catálogos de fallos técnicos:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los catálogos." });
  } finally {
    client.release();
  }
};
