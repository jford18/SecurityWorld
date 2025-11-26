import { TechnicalFailure } from '../../types';

export const calcularEstado = (reporte: TechnicalFailure): { texto: string; color: string } => {
  const {
    fecha,
    hora,
    horaFallo,
    fechaHoraFallo,
    deptResponsable,
    fechaResolucion,
    horaResolucion,
    verificacionApertura,
    verificacionCierre,
    novedadDetectada,
    estado,
  } = reporte;

  const camposCompletos =
    deptResponsable &&
    fechaResolucion &&
    horaResolucion &&
    verificacionApertura &&
    verificacionCierre &&
    novedadDetectada;

  if (camposCompletos || fechaResolucion || estado === 'RESUELTO') {
    return { texto: 'RESUELTO', color: '#4CAF50' };
  }

  const dateCandidate =
    fechaHoraFallo
    || (fecha ? `${fecha}${hora || horaFallo ? `T${(hora || horaFallo)}` : ''}` : undefined);

  const fechaFallo = dateCandidate ? new Date(dateCandidate) : fecha ? new Date(fecha) : null;
  const hoy = new Date();

  let dias = 0;
  if (fechaFallo && !Number.isNaN(fechaFallo.getTime())) {
    dias = Math.floor((hoy.getTime() - fechaFallo.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0) dias = 0;
  }

  const textoPendiente = dias === 1 ? '1 día pendiente' : `${dias} días pendiente`;

  return {
    texto: textoPendiente,
    color: '#F44336',
  };
};
