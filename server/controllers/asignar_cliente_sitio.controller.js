
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
        C.ID AS cliente_id,
        C.NOMBRE AS cliente_nombre
      FROM PUBLIC.SITIOS S
      LEFT JOIN PUBLIC.SITIOS_CLIENTE SC ON (SC.SITIO_ID = S.ID AND SC.ACTIVO = TRUE)
      LEFT JOIN PUBLIC.CLIENTES C ON (C.ID = SC.CLIENTE_ID)
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

  let transactionStarted = false;

  try {
    const [sitioResult, clienteResult] = await Promise.all([
      db.query("SELECT ID FROM PUBLIC.SITIOS WHERE ID = $1", [sitioId]),
      db.query("SELECT ID, ACTIVO FROM PUBLIC.CLIENTES WHERE ID = $1", [clienteId]),
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

    await db.query("BEGIN");
    transactionStarted = true;

    await db.query(
      `
        UPDATE PUBLIC.SITIOS_CLIENTE
        SET ACTIVO = FALSE
        WHERE SITIO_ID = $1 AND ACTIVO = TRUE;
      `,
      [sitioId]
    );

    const result = await db.query(
      `
        INSERT INTO PUBLIC.SITIOS_CLIENTE (SITIO_ID, CLIENTE_ID, ACTIVO, FECHA_ASIGNACION)
        VALUES ($1, $2, TRUE, NOW())
        RETURNING *;
      `,
      [sitioId, clienteId]
    );

    await db.query("COMMIT");
    transactionStarted = false;

    res.json(result.rows[0]);
  } catch (error) {
    if (transactionStarted) {
      await db.query("ROLLBACK");
    }
    console.error("[ASIGNAR_CLIENTE_SITIO] Error al asignar cliente:", error);
    res.status(500).json({ message: "Error al asignar cliente al sitio" });
  }
};
