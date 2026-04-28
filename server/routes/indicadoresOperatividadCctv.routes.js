import express from "express";
import {
  exportExcelOperatividadCctv,
  getDetalleOperatividadCctv,
  getFiltrosOperatividadCctv,
  getReincidenciaOperatividadCctv,
  getResumenOperatividadCctv,
  getUptimeClienteOperatividadCctv,
  getUptimeDiaOperatividadCctv,
} from "../controllers/indicadoresOperatividadCctvController.js";

const router = express.Router();

router.get("/dashboards/operatividad-cctv/filtros", getFiltrosOperatividadCctv);
router.get("/dashboards/operatividad-cctv/resumen", getResumenOperatividadCctv);
router.get("/dashboards/operatividad-cctv/detalle", getDetalleOperatividadCctv);
router.get("/dashboards/operatividad-cctv/uptime-cliente", getUptimeClienteOperatividadCctv);
router.get("/dashboards/operatividad-cctv/uptime-dia", getUptimeDiaOperatividadCctv);
router.get("/dashboards/operatividad-cctv/reincidencia", getReincidenciaOperatividadCctv);
router.get("/dashboards/operatividad-cctv/export-excel", exportExcelOperatividadCctv);

export default router;
