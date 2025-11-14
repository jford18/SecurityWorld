import pool from "../db.js";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const sanitizeNombre = (value) =>
  typeof value === "string" ? value.trim() : "";

export const getAllDepartamentosResponsables = async (_req, res) => {
  try {
    const query = `
      SELECT id, nombre
      FROM public.departamentos_responsables
      ORDER BY id ASC
    `;
    const result = await pool.query(query);
    res
      .status(200)
      .json(
        formatSuccess(
          "Listado de departamentos responsables",
          result.rows ?? []
        )
      );
  } catch (error) {
    console.error("[DEPARTAMENTOS_RESPONSABLES] Error al obtener registros:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al obtener los departamentos responsables"));
  }
};

export const getDepartamentoResponsableById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT id, nombre
      FROM public.departamentos_responsables
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Departamento responsable no encontrado"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Departamento responsable encontrado",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("[DEPARTAMENTOS_RESPONSABLES] Error al obtener registro:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al obtener el departamento responsable"));
  }
};

export const createDepartamentoResponsable = async (req, res) => {
  const nombre = sanitizeNombre(req.body?.nombre);

  if (!nombre) {
    return res
      .status(422)
      .json(formatError("El nombre del departamento responsable es obligatorio"));
  }

  try {
    const insertQuery = `
      INSERT INTO public.departamentos_responsables (nombre)
      VALUES ($1)
      RETURNING id, nombre
    `;
    const result = await pool.query(insertQuery, [nombre]);

    res
      .status(201)
      .json(
        formatSuccess(
          "Departamento responsable creado correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("[DEPARTAMENTOS_RESPONSABLES] Error al crear registro:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al crear el departamento responsable"));
  }
};

export const updateDepartamentoResponsable = async (req, res) => {
  const { id } = req.params;
  const nombre = sanitizeNombre(req.body?.nombre);

  if (!nombre) {
    return res
      .status(422)
      .json(formatError("El nombre del departamento responsable es obligatorio"));
  }

  try {
    const updateQuery = `
      UPDATE public.departamentos_responsables
      SET nombre = $1
      WHERE id = $2
      RETURNING id, nombre
    `;
    const result = await pool.query(updateQuery, [nombre, id]);

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Departamento responsable no encontrado"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Departamento responsable actualizado correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("[DEPARTAMENTOS_RESPONSABLES] Error al actualizar registro:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al actualizar el departamento responsable"));
  }
};

export const deleteDepartamentoResponsable = async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = `
      DELETE FROM public.departamentos_responsables
      WHERE id = $1
    `;
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Departamento responsable no encontrado"));
    }

    res
      .status(200)
      .json(formatSuccess("Departamento responsable eliminado correctamente"));
  } catch (error) {
    console.error("[DEPARTAMENTOS_RESPONSABLES] Error al eliminar registro:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al eliminar el departamento responsable"));
  }
};
