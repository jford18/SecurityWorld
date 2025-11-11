import pool from '../db.js';

export const getTiposArea = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tipo_area ORDER BY id ASC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener tipos de área:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getTipoAreaById = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM tipo_area WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de área no encontrado' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error al obtener tipo de área por ID:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createTipoArea = async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO tipo_area (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre, descripcion]
    );
    res.status(201).json({
      message: 'Tipo de área creado correctamente',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error al crear tipo de área:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateTipoArea = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE tipo_area SET nombre = $1, descripcion = $2, activo = $3, fecha_actualizacion = NOW() WHERE id = $4 RETURNING *',
      [nombre, descripcion, activo, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de área no encontrado' });
    }
    res.status(200).json({
      message: 'Tipo de área actualizado correctamente',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar tipo de área:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const deleteTipoArea = async (req, res) => {
  const { id } = req.params;
  try {
    console.log('Eliminando lógicamente tipo de área con ID:', id);
    const { rows } = await pool.query(
      'UPDATE tipo_area SET activo = false, fecha_actualizacion = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de área no encontrado' });
    }
    res.status(200).json({ message: 'Tipo de área eliminado (lógicamente) correctamente' });
  } catch (error) {
    console.error('Error al eliminar tipo de área:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
