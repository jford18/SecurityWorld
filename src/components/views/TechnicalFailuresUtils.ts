import { TechnicalFailure } from '../../types';

export const calcularEstado = (reporte: TechnicalFailure): { texto: string; color: string } => {
  const {
    fecha,
    deptResponsable,
    fechaResolucion,
    horaResolucion,
    verificacionApertura,
    verificacionCierre,
    novedadDetectada,
  } = reporte;

  const camposCompletos =
    deptResponsable &&
    fechaResolucion &&
    horaResolucion &&
    verificacionApertura &&
    verificacionCierre &&
    novedadDetectada;

  if (camposCompletos || fechaResolucion) {
    return { texto: 'RESUELTO', color: '#4CAF50' };
  }

  const fechaFallo = new Date(fecha);
  const hoy = new Date();
  const dias = Math.floor((hoy.getTime() - fechaFallo.getTime()) / (1000 * 60 * 60 * 24));

  return {
    texto: `${dias <= 0 ? 0 : dias} días pendientes`,
    color: '#F44336',
  };
};
