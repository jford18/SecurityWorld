import db from "../db.js";

const ensurePositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const mapRows = (rows) => {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => ({
    sitio_id: row.sitio_id,
    sitio_nombre: row.sitio_nombre,
    cliente_id: row.cliente_id,
    cliente_nombre: row.cliente_nombre,
  }));
};

export const getSitiosClientes = async (_req, res) => {
  try {
    const query = `
      SELECT
        S.ID AS sitio_id,
        S.NOMBRE AS sitio_nombre,
        S.CLIENTE_ID AS cliente_id,
        C.NOMBRE AS cliente_nombre
      FROM PUBLIC.SITIOS S
      LEFT JOIN PUBLIC.CLIENTES C ON (C.ID = S.CLIENTE_ID)
      ORDER BY S.ID;
    `;
    const result = await db.query(query);
    res.json(mapRows(result.rows));
  } catch (error) {
    console.error("[ASIGNAR_CLIENTE_SITIO] Error al obtener datos:", error);
    res.status(500).json({ message: "Error al obtener los sitios y clientes" });
  }
};

export const asignarClienteSitio = async (req, res) => {
  const { sitio_id: rawSitioId, cliente_id: rawClienteId } = req.body ?? {};
  const sitioId = ensurePositiveInteger(rawSitioId);
  const clienteId = ensurePositiveInteger(rawClienteId);

  if (!sitioId || !clienteId) {
    return res.status(400).json({ message: "Sitio y cliente son obligatorios" });
  }

  try {
    const [sitioResult, clienteResult] = await Promise.all([
      db.query("SELECT ID FROM PUBLIC.SITIOS WHERE ID = $1", [sitioId]),
      db.query("SELECT ID, ACTIVO, NOMBRE FROM PUBLIC.CLIENTES WHERE ID = $1", [clienteId]),
    ]);

    if (sitioResult.rowCount === 0) {
      return res.status(404).json({ message: "El sitio especificado no existe" });
    }

    if (clienteResult.rowCount === 0) {
      return res.status(404).json({ message: "El cliente especificado no existe" });
    }

    const { activo } = clienteResult.rows[0];
    if (activo === false) {
      return res.status(400).json({ message: "El cliente seleccionado está inactivo" });
    }

    const updateResult = await db.query(
      `
        UPDATE PUBLIC.SITIOS
        SET CLIENTE_ID = $1
        WHERE ID = $2
        RETURNING ID AS sitio_id, NOMBRE AS sitio_nombre, CLIENTE_ID AS cliente_id;
      `,
      [clienteId, sitioId]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ message: "El sitio especificado no existe" });
    }

    const updated = updateResult.rows[0];
    res.json({ ...updated, cliente_nombre: clienteResult.rows[0]?.nombre ?? null });
  } catch (error) {
    console.error("[ASIGNAR_CLIENTE_SITIO] Error al asignar cliente:", error);
    res.status(500).json({ message: "Error al asignar cliente al sitio" });
  }
};
