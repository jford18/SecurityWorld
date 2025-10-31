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

export interface CatalogoDepartamento {
  id: number;
  nombre: string;
}

export interface CatalogoTipoProblema {
  id: number;
  descripcion: string;
}

export interface CatalogoResponsable {
  id: number;
  nombre: string;
}

export interface SitioPorConsola {
  sitio: string;
  cliente: string;
  consola: string;
}

export interface CatalogoNodo {
  id: number;
  nombre: string;
}

export interface CatalogoDispositivo {
  id: number;
  nombre: string;
  estado?: string;
}

export interface TechnicalFailureCatalogs {
  departamentos: CatalogoDepartamento[];
  tiposProblema: CatalogoTipoProblema[];
  responsablesVerificacion: CatalogoResponsable[];
  nodos: CatalogoNodo[];
  nodoCliente: { nodo: string; cliente: string }[];
  tiposEquipo: string[];
  tiposProblemaEquipo: string[];
  dispositivos: CatalogoDispositivo[];
  sitiosPorConsola: SitioPorConsola[];
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


export enum View {
  Dashboard,
  Failures,
  Intrusions,
  AlertsReport,
  // NEW: Vista para el mantenimiento de roles.
  AdminRoles,
  // NEW: Vista para el mantenimiento de usuarios.
  AdminUsuarios,
}
