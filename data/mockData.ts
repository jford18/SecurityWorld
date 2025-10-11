
import { TechnicalFailure, Intrusion, Device, AlertData } from '../types';

export const technicalFailuresData: TechnicalFailure[] = [
  {
    fecha: "2025-10-09",
    equipo_afectado: "Cámara 01",
    descripcion_fallo: "No transmite video",
    responsable: "Operador A",
    accion_tomada: "Reinicio manual",
    estado: "Resuelto"
  },
  {
    fecha: "2025-10-08",
    equipo_afectado: "Sensor de Puerta B4",
    descripcion_fallo: "Falsa alarma recurrente",
    responsable: "Técnico B",
    accion_tomada: "Calibración de sensor",
    estado: "Resuelto"
  },
  {
    fecha: "2025-10-09",
    equipo_afectado: "Panel Alarma 02",
    descripcion_fallo: "No responde a comandos",
    responsable: "Operador C",
    accion_tomada: "Escalado a soporte N2",
    estado: "Pendiente"
  }
];

export const intrusionsData: Intrusion[] = [
  {
    fecha: "2025-10-09",
    ubicacion: "Bodega 3",
    tipo_intrusion: "Movimiento no autorizado",
    nivel_alerta: "Alta",
    observacion: "Detectado por sensor PIR",
    estado: "Pendiente"
  },
  {
    fecha: "2025-10-07",
    ubicacion: "Perímetro Norte",
    tipo_intrusion: "Cruce de línea virtual",
    nivel_alerta: "Media",
    observacion: "Cámara PTZ-04 capturó el evento",
    estado: "Atendido"
  }
];

export const deviceInventoryData: Device[] = [
  {id: 1, nombre: "Cámara 01 - Zona Sur", tipo: "Cámara IP", estado: "online"},
  {id: 2, nombre: "Panel Alarma 02", tipo: "Panel", estado: "offline"},
  {id: 3, nombre: "Cámara 02 - Acceso Principal", tipo: "Cámara IP", estado: "online"},
  {id: 4, nombre: "Sensor Puerta Bodega 3", tipo: "Sensor", estado: "online"},
  {id: 5, nombre: "Cámara 03 - Estacionamiento", tipo: "Cámara IP", estado: "online"},
  {id: 6, nombre: "Panel Alarma 01", tipo: "Panel", estado: "online"},
  {id: 7, nombre: "Micrófono 04 - Sala de Juntas", tipo: "Micrófono", estado: "offline"}
];

export const alertsData: AlertData = {
  creadas: [
    {id: 1, equipo: "Cámara 01", tipo: "Pérdida de señal", fecha: "2025-10-09T08:00:00"},
    {id: 4, equipo: "Sensor Movimiento 05", tipo: "Batería baja", fecha: "2025-10-09T10:15:00"},
  ],
  aceptadas: [
    {id: 2, equipo: "Panel 02", tipo: "Intrusión", fecha: "2025-10-09T08:10:00"},
    {id: 5, equipo: "Cámara 03", tipo: "Obstrucción de lente", fecha: "2025-10-09T11:00:00"},
  ],
  ignoradas: [
    {id: 3, equipo: "Micrófono 04", tipo: "Audio anómalo", fecha: "2025-10-09T09:30:00"}
  ]
};

// New Mock Data for Technical Failures Form
export const technicalFailureMocks = {
  nodos: [
    { id: 1, nombre: "CTO-ZULEMA" },
    { id: 2, nombre: "CTO-FLORIDA" },
    { id: 3, nombre: "CTO-ALAMOS" }
  ],
  proyectos: [
    { id: 1, nombre: "CLARO" },
    { id: 2, nombre: "NOVOPAN" },
    { id: 3, nombre: "PRONACA" }
  ],
  nodo_proyecto: [
    { nodo: "CTO-ZULEMA", proyecto: "CLARO" },
    { nodo: "CTO-FLORIDA", proyecto: "NOVOPAN" },
    { nodo: "CTO-ALAMOS", proyecto: "PRONACA" }
  ],
  consolas: [
    { id: 1, nombre: "ALMETAL" },
    { id: 2, nombre: "ARQUEOL" },
    { id: 3, nombre: "AVICA" },
    { id: 4, nombre: "CLARO" },
    { id: 5, nombre: "NOVOPAN" },
    { id: 6, nombre: "PRONACA" },
  ],
  sitios: [
    { id: 1, nombre: "[AVIC]-SEC B" },
    { id: 2, nombre: "[NOB]-ALM-R.RCH1-ER4" },
    { id: 3, nombre: "[PRONACA]-ERP-02" }
  ],
  consola_proyecto: [
    { consola: "CLARO", proyecto: "PRONACA" },
    { consola: "NOVOPAN", proyecto: "NOVOPAN" },
    { consola: "PRONACA", proyecto: "PRONACA" },
    { consola: "AVICA", proyecto: "AVICA" }
  ],
  consola_sitios: [
    { consola: "CLARO", sitios: ["[CLA]-SEC A", "[CLA]-SEC B"] },
    { consola: "NOVOPAN", sitios: ["[NOV]-ALM-R.RCH1-ER4"] },
    { consola: "PRONACA", sitios: ["[PRO]-ERP-02"] },
    { consola: "AVICA", sitios: ["[AVIC]-SEC B"] },
    { consola: "ALMETAL", sitios: ["[AVIC]-SEC B"] },
    { consola: "ARQUEOL", sitios: ["[NOB]-ALM-R.RCH1-ER4" ] },
  ],
  tipos_equipo: [
    "Cámara",
    "Grabador",
    "GPS",
    "Panel de alarmas",
    "PC monitoreo",
    "Detector de humo",
    "Botón de pánico",
    "Celular base"
  ],
  dispositivos: [
    { id: 1, nombre: "Cam01-Zona Norte", estado: "online" },
    { id: 2, nombre: "Cam02-Zona Sur", estado: "offline" }
  ]
};
