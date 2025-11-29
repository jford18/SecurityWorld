
export interface TechnicalFailure {
  id: string;
  fecha: string;
  hora?: string;
  horaFallo?: string;
  fechaHoraFallo?: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  // Campos nuevos (solo supervisor)
  deptResponsable?: string;
  departamentoResponsableId?: string | number | null;
  fechaResolucion?: string;
  horaResolucion?: string;
  fechaHoraResolucion?: string;
  verificacionApertura?: string;
  verificacionCierre?: string;
  verificacionAperturaId?: string | number | null;
  verificacionCierreId?: string | number | null;
  novedadDetectada?: string;
  tipoProblemaNombre?: string;
  tipoAfectacion?: string;
  equipoAfectado?: string;
  tipoProblema?: string;
  estado?: string | null;
  sitio_nombre?: string;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
  responsable_verificacion_cierre_id?: number | string | null;
  responsable_verificacion_cierre_nombre?: string | null;
  ultimo_usuario_edito_id?: number | null;
  ultimo_usuario_edito_nombre?: string | null;
}

export interface FailureDurationResponse {
  duracionTexto: string;
  totalMinutos: number;
}

export interface FailureHistoryEntry {
  id: number;
  novedad_detectada?: string | null;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
  verificacion_apertura?: string | null;
  verificacion_cierre?: string | null;
}

export interface FailureHistory {
  departamento_responsable: string | null;
  fecha: string | null;
  hora: string | null;
  fecha_resolucion: string | null;
  hora_resolucion: string | null;
  fecha_creacion: string | null;
  estado: string | null;
  duracionTexto: string | null;
  totalMinutos: number | null;
  acciones: FailureHistoryEntry[];
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
