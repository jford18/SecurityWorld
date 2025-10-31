export const nodos = [
  { id: 1, nombre: "CTO-ZULEMA" },
  { id: 2, nombre: "CTO-FLORIDA" },
  { id: 3, nombre: "CTO-ALAMOS" }
];

export const nodoCliente = [
  { nodo: "CTO-ZULEMA", cliente: "CLARO" },
  { nodo: "CTO-FLORIDA", cliente: "NOVOPAN" },
  { nodo: "CTO-ALAMOS", cliente: "PRONACA" }
];

export const tiposEquipo = [
  "Cámara",
  "Grabador",
  "GPS",
  "Panel de alarmas",
  "PC monitoreo",
  "Detector de humo",
  "Botón de pánico",
  "Celular base"
];

export const tiposProblemaEquipo = [
  "Equipo con daño físico",
  "Intermitencia",
  "Equipo mal enlazado al software de monitoreo",
  "Equipo no funciona",
  "Equipo no funciona correctamente",
  "Equipo no graba",
  "Falsas activaciones",
  "Mala resolución (cámara)",
  "Cámara sucia",
  "Cámara desacuadrada",
  "Desenganche",
  "Distorsión de cámara",
  "Fecha/hora errada",
  "Equipo con clave genérica",
  "Pérdida de visual",
  "Tiempos altos",
  "Móvil incomunicado",
  "Caídas recurrentes"
];

export const dispositivos = [
  { id: 1, nombre: "Cam01-Zona Norte", estado: "online" },
  { id: 2, nombre: "Cam02-Zona Sur", estado: "offline" }
];

export const sitiosPorConsola = [
  { sitio: "[RBP]-ZUL1-TLLR", cliente: "REYBANPAC", consola: "OPERADOR 8" },
  { sitio: "[RBP]-ZUL1-B.CTRA", cliente: "REYBANPAC", consola: "OPERADOR 8" },
  { sitio: "[NOB]-ALM-ZAP-EMP4", cliente: "NOBOA", consola: "ALAMOS" },
  { sitio: "[NOV]-LS.ANG-VIV", cliente: "NOVOPAN", consola: "GODCORP" },
  { sitio: "[PRO]-L.LND-SIT3A", cliente: "PRONACA", consola: "PRONACA" },
  { sitio: "[SW]-OFIC-PRINC", cliente: "SECURITY WORLD", consola: "OPERADOR 1" },
  { sitio: "[SW]-BOD-NORTE", cliente: "SECURITY WORLD", consola: "OPERADOR 1" },
  { sitio: "[SW]-BOD-SUR", cliente: "SECURITY WORLD", consola: "OPERADOR 2" },
  { sitio: "[JUL]-PLANTA-SUR", cliente: "JULIA", consola: "JULIA" },
  { sitio: "[MART]-ACCESO-1", cliente: "MARTINICA", consola: "MARTINICA" }
];

export default {
  nodos,
  nodoCliente,
  tiposEquipo,
  tiposProblemaEquipo,
  dispositivos,
  sitiosPorConsola
};
