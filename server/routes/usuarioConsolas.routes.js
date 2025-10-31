import { Router } from 'express';
import {
  getUsuarioConsolas,
  createUsuarioConsola,
  deleteUsuarioConsola,
} from '../controllers/usuarioConsolas.controller.js';

const router = Router();

router.get('/', getUsuarioConsolas);
router.post('/', createUsuarioConsola);
router.delete('/:usuario_id/:consola_id', deleteUsuarioConsola);

export default router;
