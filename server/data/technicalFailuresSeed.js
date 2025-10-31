export const technicalFailuresSeed = [
  {
    fecha: "2025-10-09",
    equipo_afectado: "Cámara 01",
    descripcion_fallo: "No transmite video",
    responsable: "Operador A",
    responsableUsername: "operador_a",
    deptResponsable: "Técnico",
    fechaResolucion: "2025-10-09",
    horaResolucion: "10:00",
    verificacionApertura: "Luis Torres",
    verificacionAperturaUsername: "luis.torres",
    verificacionCierre: "Luis Torres",
    verificacionCierreUsername: "luis.torres",
    novedadDetectada: "Se reinició la cámara y volvió a transmitir video."
  },
  {
    fecha: "2025-10-08",
    equipo_afectado: "Sensor de Puerta B4",
    descripcion_fallo: "Falsa alarma recurrente",
    responsable: "Técnico B",
    responsableUsername: "tecnico_b",
    deptResponsable: "Técnico",
    fechaResolucion: "2025-10-08",
    horaResolucion: "14:30",
    verificacionApertura: "Andrea Molina",
    verificacionAperturaUsername: "andrea.molina",
    verificacionCierre: "Andrea Molina",
    verificacionCierreUsername: "andrea.molina",
    novedadDetectada: "Sensor calibrado, no se repitieron falsas alarmas."
  },
  {
    fecha: "2025-10-09",
    equipo_afectado: "Panel Alarma 02",
    descripcion_fallo: "No responde a comandos",
    responsable: "Operador C",
    responsableUsername: "operador_c"
  }
];

export default technicalFailuresSeed;
