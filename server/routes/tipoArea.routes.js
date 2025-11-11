import express from 'express';
import * as tipoAreaController from '../controllers/tipoArea.controller.js';

const router = express.Router();

router.get('/', tipoAreaController.getAll);
router.get('/:id', tipoAreaController.getById);
router.post('/', tipoAreaController.create);
router.put('/:id', tipoAreaController.update);
router.delete('/:id', tipoAreaController.logicalDelete);

export default router;
