import express from 'express';
import {
  getTiposArea,
  getTipoAreaById,
  createTipoArea,
  updateTipoArea,
  deleteTipoArea,
} from '../controllers/tipoArea.controller.js';

const router = express.Router();

router.get('/', getTiposArea);
router.get('/:id', getTipoAreaById);
router.post('/', createTipoArea);
router.put('/:id', updateTipoArea);
router.delete('/:id', deleteTipoArea);

export default router;
