import pool from "../config/db.js";

const mapUsuarios = (rows = []) =>
  rows
    .map((row) => ({
      id: row.id,
      nombre:
        row.nombre ?? row.nombre_usuario ?? row.nombre_completo ?? null,
    }))
    .filter((row) => Boolean(row.nombre));

export const getTiposProblema = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, descripcion FROM catalogo_tipo_problema ORDER BY descripcion"
    );
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/catalogos/tipos-problema (getTiposProblema):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los tipos de problema." });
  }
};

export const getDepartamentos = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre FROM departamentos_responsables ORDER BY nombre"
    );
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/catalogos/departamentos (getDepartamentos):`,
      error.message
    );
    return res
      .status(500)
      .json({
        message: "Error al obtener los departamentos responsables.",
      });
  }
};

export const getTiposEquipo = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre FROM tipos_equipo ORDER BY nombre"
    );
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/catalogos/tipos-equipo (getTiposEquipo):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los tipos de equipo." });
  }
};

export const getResponsables = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, COALESCE(u.nombre_completo, u.nombre_usuario) AS nombre
      FROM usuarios u
      WHERE u.activo = true
      ORDER BY nombre
    `);
    return res.json(mapUsuarios(result.rows));
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/catalogos/responsables (getResponsables):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los responsables." });
  }
};

export const getCatalogos = async (_req, res) => {
  try {
    const [
      departamentosResult,
      tiposProblemaResult,
      responsablesResult,
      tiposEquipoResult,
    ] = await Promise.all([
      pool.query(
        "SELECT id, nombre FROM departamentos_responsables ORDER BY nombre"
      ),
      pool.query(
        "SELECT id, descripcion FROM catalogo_tipo_problema ORDER BY descripcion"
      ),
      pool.query(`
        SELECT u.id, COALESCE(u.nombre_completo, u.nombre_usuario) AS nombre
        FROM usuarios u
        WHERE u.activo = true
        ORDER BY nombre
      `),
      pool.query("SELECT id, nombre FROM tipos_equipo ORDER BY nombre"),
    ]);

    return res.json({
      departamentos: departamentosResult.rows ?? [],
      tiposProblema: tiposProblemaResult.rows ?? [],
      responsables: mapUsuarios(responsablesResult.rows),
      tiposEquipo: tiposEquipoResult.rows ?? [],
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/catalogos (getCatalogos):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los catálogos." });
  }
};
