
export interface TechnicalFailure {
  fecha: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  accion_tomada: string;
  estado: "Resuelto" | "Pendiente";
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

export enum View {
  Dashboard,
  Failures,
  Intrusions,
  Devices,
  Logs,
  Architecture,
}
