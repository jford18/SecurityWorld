import db from "../db.js";

export const getCatalogoTipoProblema = async (_req, res) => {
  try {
    const sql = `
      SELECT
        id,
        descripcion
      FROM public.catalogo_tipo_problema
      ORDER BY id ASC;
    `;
    const { rows } = await db.query(sql);
    const data = rows.map((row) => ({
      id: row.id,
      descripcion: row.descripcion,
    }));

    res.status(200).json(data);
  } catch (err) {
    console.error("[API][ERROR] /api/catalogo-tipo-problema:", err.message);
    res
      .status(500)
      .json({ error: "Error al obtener catálogo de tipos de problema" });
  }
};
