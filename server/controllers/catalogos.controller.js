import db from "../config/db.js";

const pool = db;

const mapUsuarios = (rows = []) =>
  rows
    .map((row) => ({
      id: row.id,
      nombre:
        row.nombre ?? row.nombre_usuario ?? row.nombre_completo ?? null,
    }))
    .filter((row) => Boolean(row.nombre));

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

export const getTiposEquipo = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT id, nombre FROM tipos_equipo ORDER BY nombre"
    );
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener los tipos de equipo:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los tipos de equipo." });
  } finally {
    client.release();
  }
};

export const getResponsables = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT u.id, COALESCE(u.nombre_completo, u.nombre_usuario) AS nombre
      FROM usuarios u
      WHERE u.activo = true
      ORDER BY nombre
    `);
    return res.json(mapUsuarios(result.rows));
  } catch (error) {
    console.error("Error al obtener los responsables:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los responsables." });
  } finally {
    client.release();
  }
};

export const getCatalogos = async (_req, res) => {
  const client = await pool.connect();

  try {
    const [
      departamentosResult,
      tiposProblemaResult,
      responsablesResult,
      tiposEquipoResult,
    ] = await Promise.all([
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
      client.query("SELECT id, nombre FROM tipos_equipo ORDER BY nombre"),
    ]);

    return res.json({
      departamentos: departamentosResult.rows ?? [],
      tiposProblema: tiposProblemaResult.rows ?? [],
      responsables: mapUsuarios(responsablesResult.rows),
      tiposEquipo: tiposEquipoResult.rows ?? [],
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
