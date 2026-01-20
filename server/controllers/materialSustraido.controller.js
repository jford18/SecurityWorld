import {
  createMaterialSustraido,
  findMaterialSustraidoByDescripcion,
  getMaterialSustraidoById,
  listMaterialSustraido,
  softDeleteMaterialSustraido,
  updateMaterialSustraido,
} from '../services/materialSustraido.service.js';

const formatSuccess = (message, data = null) => ({
  status: 'success',
  message,
  data,
});

const formatError = (message) => ({
  status: 'error',
  message,
});

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeBoolean = (value, defaultValue = null) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 't', 'on', 'si', 'sí', 'activo', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'f', 'off', 'no', 'n', 'inactivo'].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

export const listMaterialSustraidos = async (req, res) => {
  try {
    const { search = '', estado, page = 1, limit = 10 } = req.query ?? {};

    const result = await listMaterialSustraido({
      search,
      estado,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error al listar materiales sustraídos:', error);
    return res
      .status(500)
      .json(formatError('Error al listar los materiales sustraídos'));
  }
};

export const getMaterialSustraido = async (req, res) => {
  const { id } = req.params;

  try {
    const material = await getMaterialSustraidoById(id);

    if (!material) {
      return res
        .status(404)
        .json(formatError('El material sustraído solicitado no existe'));
    }

    return res
      .status(200)
      .json(formatSuccess('Material sustraído obtenido correctamente', material));
  } catch (error) {
    console.error('Error al obtener material sustraído:', error);
    return res
      .status(500)
      .json(formatError('Error al obtener el material sustraído'));
  }
};

export const createMaterialSustraidoHandler = async (req, res) => {
  const { descripcion, estado } = req.body ?? {};
  const trimmedDescripcion = normalizeText(descripcion);

  if (!trimmedDescripcion) {
    return res
      .status(422)
      .json(formatError('La descripción del material sustraído es obligatoria'));
  }

  if (trimmedDescripcion.length > 200) {
    return res
      .status(422)
      .json(formatError('La descripción no debe superar los 200 caracteres'));
  }

  try {
    const duplicate = await findMaterialSustraidoByDescripcion(trimmedDescripcion);

    if (duplicate) {
      return res
        .status(409)
        .json(formatError('Ya existe un material sustraído con esa descripción'));
    }

    const normalizedEstado = normalizeBoolean(estado, true);
    const created = await createMaterialSustraido({
      descripcion: trimmedDescripcion,
      estado: normalizedEstado,
    });

    return res
      .status(201)
      .json(formatSuccess('Material sustraído creado correctamente', created));
  } catch (error) {
    console.error('Error al crear material sustraído:', error);
    return res
      .status(500)
      .json(formatError('Error al crear el material sustraído'));
  }
};

export const updateMaterialSustraidoHandler = async (req, res) => {
  const { id } = req.params;
  const { descripcion, estado } = req.body ?? {};

  const updates = {};

  if (descripcion !== undefined) {
    const trimmedDescripcion = normalizeText(descripcion);

    if (!trimmedDescripcion) {
      return res
        .status(422)
        .json(formatError('La descripción del material sustraído es obligatoria'));
    }

    if (trimmedDescripcion.length > 200) {
      return res
        .status(422)
        .json(formatError('La descripción no debe superar los 200 caracteres'));
    }

    try {
      const duplicate = await findMaterialSustraidoByDescripcion(trimmedDescripcion, id);

      if (duplicate) {
        return res
          .status(409)
          .json(formatError('Ya existe un material sustraído con esa descripción'));
      }
    } catch (error) {
      console.error('Error al validar duplicados de material sustraído:', error);
      return res
        .status(500)
        .json(formatError('Error al actualizar el material sustraído'));
    }

    updates.descripcion = trimmedDescripcion;
  }

  if (estado !== undefined) {
    const normalizedEstado = normalizeBoolean(estado, null);

    if (normalizedEstado === null) {
      return res.status(422).json(formatError('El estado enviado no es válido'));
    }

    updates.estado = normalizedEstado;
  }

  if (Object.keys(updates).length === 0) {
    return res
      .status(400)
      .json(formatError('No se enviaron campos para actualizar'));
  }

  try {
    const updated = await updateMaterialSustraido(id, updates);

    if (!updated) {
      return res
        .status(404)
        .json(formatError('El material sustraído solicitado no existe'));
    }

    return res
      .status(200)
      .json(formatSuccess('Material sustraído actualizado correctamente', updated));
  } catch (error) {
    console.error('Error al actualizar material sustraído:', error);
    return res
      .status(500)
      .json(formatError('Error al actualizar el material sustraído'));
  }
};

export const deleteMaterialSustraidoHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await softDeleteMaterialSustraido(id);

    if (!deleted) {
      return res
        .status(404)
        .json(formatError('El material sustraído ya estaba inactivo o no existe'));
    }

    return res
      .status(200)
      .json(formatSuccess('Material sustraído desactivado correctamente'));
  } catch (error) {
    console.error('Error al desactivar material sustraído:', error);
    return res
      .status(500)
      .json(formatError('Error al desactivar el material sustraído'));
  }
};
