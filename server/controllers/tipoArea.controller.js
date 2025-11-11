import * as tipoAreaService from '../services/tipoArea.service.js';

export const getAll = async (req, res, next) => {
  try {
    const tiposArea = await tipoAreaService.getAll();
    res.json({ data: tiposArea });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tipoArea = await tipoAreaService.getById(id);
    if (!tipoArea) {
      return res.status(404).json({ message: 'Tipo de Área no encontrado' });
    }
    res.json({ data: tipoArea });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const newTipoArea = await tipoAreaService.create(req.body);
    res.status(201).json({ data: newTipoArea });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedTipoArea = await tipoAreaService.update(id, req.body);
    if (!updatedTipoArea) {
      return res.status(404).json({ message: 'Tipo de Área no encontrado' });
    }
    res.json({ data: updatedTipoArea });
  } catch (error) {
    next(error);
  }
};

export const logicalDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedTipoArea = await tipoAreaService.logicalDelete(id);
    if (!deletedTipoArea) {
      return res.status(404).json({ message: 'Tipo de Área no encontrado' });
    }
    res.json({ message: 'Tipo de Área eliminado lógicamente' });
  } catch (error) {
    next(error);
  }
};
