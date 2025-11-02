
export interface TechnicalFailure {
  id: string;
  fecha: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  // Campos nuevos (solo supervisor)
  deptResponsable?: string;
  fechaResolucion?: string;
  horaResolucion?: string;
  verificacionApertura?: string;
  verificacionCierre?: string;
  novedadDetectada?: string;
}

export interface Intrusion {
  fecha: string;
  ubicacion: string;
  tipo_intrusion: string;
  nivel_alerta: "Alta" | "Media" | "Baja";
  observacion: string;
  estado: "Pendiente" | "Atendido";
}

export interface Device {
  id: number;
  nombre: string;
  tipo: string;
  estado: "online" | "offline";
}

export interface Alert {
  id: number;
  equipo: string;
  tipo: string;
  fecha: string;
}

export interface AlertData {
  creadas: Alert[];
  aceptadas: Alert[];
  ignoradas: Alert[];
}

export interface HikEvent {
  eventIndexCode: string;
  eventType: string;
  srcType: string;
  srcIndex: string;
  description: string;
  startTime: string;
  stopTime: string;
  eventPicUri: string;
  linkCameraIndexCode: string;
}

export interface HikCamera {
  alarmOutputIndexCode: string;
  alarmOutputName: string;
  regionIndexCode: string;
  devIndexCode: string;
  devResourceType: string;
  status: number; // 1 for active, 0 for inactive
}
