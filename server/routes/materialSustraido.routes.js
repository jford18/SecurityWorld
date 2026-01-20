import { Router } from 'express';
import {
  createMaterialSustraidoHandler,
  deleteMaterialSustraidoHandler,
  getMaterialSustraido,
  listMaterialSustraidos,
  updateMaterialSustraidoHandler,
} from '../controllers/materialSustraido.controller.js';

const router = Router();

router.get('/', listMaterialSustraidos);
router.get('/:id', getMaterialSustraido);
router.post('/', createMaterialSustraidoHandler);
router.put('/:id', updateMaterialSustraidoHandler);
router.delete('/:id', deleteMaterialSustraidoHandler);

export default router;
