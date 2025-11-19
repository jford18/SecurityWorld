import { TechnicalFailure, Intrusion, Device, AlertData } from '../types';

export const technicalFailuresData: Omit<TechnicalFailure, 'id'>[] = [
  {
    fecha: "2025-10-09",
    equipo_afectado: "Cámara 01",
    descripcion_fallo: "No transmite video",
    responsable: "Operador A",
    deptResponsable: "Técnico",
    fechaResolucion: "2025-10-09",
    horaResolucion: "10:00",
    verificacionApertura: "Luis Torres",
    verificacionCierre: "Luis Torres",
    novedadDetectada: "Se reinició la cámara y volvió a transmitir video."
  },
  {
    fecha: "2025-10-08",
    equipo_afectado: "Sensor de Puerta B4",
    descripcion_fallo: "Falsa alarma recurrente",
    responsable: "Técnico B",
    deptResponsable: "Técnico",
    fechaResolucion: "2025-10-08",
    horaResolucion: "14:30",
    verificacionApertura: "Andrea Molina",
    verificacionCierre: "Andrea Molina",
    novedadDetectada: "Sensor calibrado, no se repitieron falsas alarmas."
  },
  {
    fecha: "2025-10-09",
    equipo_afectado: "Panel Alarma 02",
    descripcion_fallo: "No responde a comandos",
    responsable: "Operador C",
  }
];

export const intrusionsData: Intrusion[] = [
  {
    id: 1,
    fecha_evento: "2025-10-09T08:10:00.000Z",
    fecha_reaccion: "2025-10-09T08:13:00.000Z",
    ubicacion: "Bodega 3",
    tipo: "Movimiento no autorizado",
    estado: "Pendiente",
    descripcion: "Detectado por sensor PIR",
    llego_alerta: true,
  },
  {
    id: 2,
    fecha_evento: "2025-10-07T17:45:00.000Z",
    fecha_reaccion: null,
    ubicacion: "Perímetro Norte",
    tipo: "Cruce de línea virtual",
    estado: "Atendido",
    descripcion: "Cámara PTZ-04 capturó el evento",
    llego_alerta: false,
  },
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

export const sitiosPorConsola = [
  { "sitio": "[RBP]-ZUL1-TLLR", "cliente": "REYBANPAC", "consola": "OPERADOR 8" },
  { "sitio": "[RBP]-ZUL1-B.CTRA", "cliente": "REYBANPAC", "consola": "OPERADOR 8" },
  { "sitio": "[NOB]-ALM-ZAP-EMP4", "cliente": "NOBOA", "consola": "ALAMOS" },
  { "sitio": "[NOV]-LS.ANG-VIV", "cliente": "NOVOPAN", "consola": "GODCORP" },
  { "sitio": "[PRO]-L.LND-SIT3A", "cliente": "PRONACA", "consola": "PRONACA" },
  { "sitio": "[SW]-OFIC-PRINC", "cliente": "SECURITY WORLD", "consola": "OPERADOR 1" },
  { "sitio": "[SW]-BOD-NORTE", "cliente": "SECURITY WORLD", "consola": "OPERADOR 1" },
  { "sitio": "[SW]-BOD-SUR", "cliente": "SECURITY WORLD", "consola": "OPERADOR 2" },
  { "sitio": "[JUL]-PLANTA-SUR", "cliente": "JULIA", "consola": "JULIA" },
  { "sitio": "[MART]-ACCESO-1", "cliente": "MARTINICA", "consola": "MARTINICA" }
];


// New Mock Data for Technical Failures Form
export const technicalFailureMocks = {
  nodos: [
    { id: 1, nombre: "CTO-ZULEMA" },
    { id: 2, nombre: "CTO-FLORIDA" },
    { id: 3, nombre: "CTO-ALAMOS" }
  ],
  clientes: [
    { id: 1, nombre: "CLARO" },
    { id: 2, nombre: "NOVOPAN" },
    { id: 3, nombre: "PRONACA" }
  ],
  nodo_cliente: [
    { nodo: "CTO-ZULEMA", cliente: "CLARO" },
    { nodo: "CTO-FLORIDA", cliente: "NOVOPAN" },
    { nodo: "CTO-ALAMOS", cliente: "PRONACA" }
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
  tipos_problema_equipo: [
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
  ],
  dispositivos: [
    { id: 1, nombre: "Cam01-Zona Norte", estado: "online" },
    { id: 2, nombre: "Cam02-Zona Sur", estado: "offline" }
  ]
};

export const supervisorData = {
  responsables_verificacion: [
    "Luis Torres",
    "Andrea Molina",
    "Carlos García",
    "Patricia Ruiz",
    "Jorge Cabrera"
  ],
  dept_responsables: ["Técnico", "Proveedor", "Cliente", "Redes"]
};


// New Mock Data for Alerts Report by Shift
export const hikEventsData = {
  code: "0",
  msg: "success",
  data: {
    total: 9,
    pageNo: 1,
    pageSize: 15,
    list: [
      // Turno 1 (07:00 - 15:00)
      {
        eventIndexCode: "E1001",
        eventType: "131329", // Falsa
        srcType: "camera",
        srcIndex: "CAM01",
        description: "Intrusión detectada en Zona A",
        startTime: "2025-10-11T07:02:00+00:00",
        stopTime: "2025-10-11T07:05:30+00:00",
        eventPicUri: "url:/mock/img/alerta1.jpg",
        linkCameraIndexCode: "CAM01",
      },
      {
        eventIndexCode: "E1002",
        eventType: "131330", // Verdadera
        srcType: "camera",
        srcIndex: "CAM02",
        description: "Pérdida de video en cámara principal",
        startTime: "2025-10-11T08:10:00+00:00",
        stopTime: "2025-10-11T08:11:00+00:00",
        eventPicUri: "url:/mock/img/alerta2.jpg",
        linkCameraIndexCode: "CAM02",
      },
      {
        eventIndexCode: "E1003",
        eventType: "131331", // No categorizada
        srcType: "camera",
        srcIndex: "CAM03",
        description: "Movimiento detectado en bodega",
        startTime: "2025-10-11T09:15:00+00:00",
        stopTime: "2025-10-11T09:16:45+00:00",
        eventPicUri: "url:/mock/img/alerta3.jpg",
        linkCameraIndexCode: "CAM03",
      },
      // Turno 2 (15:00 - 23:00)
      {
        eventIndexCode: "E2001",
        eventType: "131329", // Falsa
        srcType: "camera",
        srcIndex: "CAM04",
        description: "Cruce de línea en perímetro",
        startTime: "2025-10-11T15:30:00+00:00",
        stopTime: "2025-10-11T15:32:15+00:00",
        eventPicUri: "url:/mock/img/alerta4.jpg",
        linkCameraIndexCode: "CAM04",
      },
      {
        eventIndexCode: "E2002",
        eventType: "131330", // Verdadera
        srcType: "camera",
        srcIndex: "CAM01",
        description: "Fallo de grabación",
        startTime: "2025-10-11T18:45:00+00:00",
        stopTime: "2025-10-11T18:55:00+00:00",
        eventPicUri: "url:/mock/img/alerta5.jpg",
        linkCameraIndexCode: "CAM01",
      },
      {
        eventIndexCode: "E2003",
        eventType: "131329", // Falsa
        srcType: "camera",
        srcIndex: "CAM05",
        description: "Objeto abandonado",
        startTime: "2025-10-11T21:05:00+00:00",
        stopTime: "2025-10-11T21:06:30+00:00",
        eventPicUri: "url:/mock/img/alerta6.jpg",
        linkCameraIndexCode: "CAM05",
      },
      // Turno 3 (23:00 - 07:00)
      {
        eventIndexCode: "E3001",
        eventType: "131330", // Verdadera
        srcType: "camera",
        srcIndex: "CAM02",
        description: "Intrusión nocturna",
        startTime: "2025-10-11T23:50:00+00:00",
        stopTime: "2025-10-11T23:58:10+00:00",
        eventPicUri: "url:/mock/img/alerta7.jpg",
        linkCameraIndexCode: "CAM02",
      },
      {
        eventIndexCode: "E3002",
        eventType: "131332", // No categorizada
        srcType: "camera",
        srcIndex: "CAM03",
        description: "Audio anómalo detectado",
        startTime: "2025-10-12T02:20:00+00:00",
        stopTime: "2025-10-12T02:21:00+00:00",
        eventPicUri: "url:/mock/img/alerta8.jpg",
        linkCameraIndexCode: "CAM03",
      },
      {
        eventIndexCode: "E3003",
        eventType: "131329", // Falsa
        srcType: "camera",
        srcIndex: "CAM01",
        description: "Sombra en sensor de movimiento",
        startTime: "2025-10-12T04:15:00+00:00",
        stopTime: "2025-10-12T04:15:45+00:00",
        eventPicUri: "url:/mock/img/alerta9.jpg",
        linkCameraIndexCode: "CAM01",
      },
    ],
  },
};

export const hikCamerasData = {
  code: "0",
  msg: "Success",
  data: [
    { alarmOutputIndexCode: "CAM01", alarmOutputName: "Camara Entrada Principal", regionIndexCode: "REG01", devIndexCode: "1", devResourceType: "0", status: 1 },
    { alarmOutputIndexCode: "CAM02", alarmOutputName: "Camara Bodega", regionIndexCode: "REG01", devIndexCode: "2", devResourceType: "0", status: 1 },
    { alarmOutputIndexCode: "CAM03", alarmOutputName: "Camara Perimetro Norte", regionIndexCode: "REG02", devIndexCode: "3", devResourceType: "0", status: 1 },
    { alarmOutputIndexCode: "CAM04", alarmOutputName: "Camara Estacionamiento", regionIndexCode: "REG02", devIndexCode: "4", devResourceType: "0", status: 0 },
    { alarmOutputIndexCode: "CAM05", alarmOutputName: "Camara Oficina", regionIndexCode: "REG01", devIndexCode: "5", devResourceType: "0", status: 1 },
  ]
};

// Data for processed events
export const hikControllingData = {
  code: "0",
  msg: "success",
  data: {
    processed: ["E1001", "E1003", "E2002", "E2003", "E3001"],
  }
};