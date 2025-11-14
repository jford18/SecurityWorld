import { TechnicalFailure } from '../../types';

export const calcularEstado = (reporte: TechnicalFailure): { texto: string; color: string } => {
  const {
    fecha,
    fechaHoraFallo,
    deptResponsable,
    departamentoResponsableId,
    fechaResolucion,
    horaResolucion,
    verificacionApertura,
    verificacionCierre,
    responsableVerificacionApertura,
    responsableVerificacionCierre,
    novedadDetectada,
  } = reporte;

  const camposCompletos =
    (deptResponsable || departamentoResponsableId != null) &&
    fechaResolucion &&
    horaResolucion &&
    (responsableVerificacionApertura || verificacionApertura) &&
    (responsableVerificacionCierre || verificacionCierre) &&
    novedadDetectada;

  if (camposCompletos || fechaResolucion) {
    return { texto: 'RESUELTO', color: '#4CAF50' };
  }

  const fechaBase = fechaHoraFallo || fecha;
  const fechaFallo = fechaBase ? new Date(fechaBase) : new Date();
  const hoy = new Date();
  const dias = Math.floor((hoy.getTime() - fechaFallo.getTime()) / (1000 * 60 * 60 * 24));

  return {
    texto: `${dias <= 0 ? 0 : dias} días pendientes`,
    color: '#F44336',
  };
};
