export interface TechnicalFailure {
  id: string;
  fecha: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  // Campos nuevos (solo supervisor)
  deptResponsable?: string;
  departamentoResponsableId?: string;
  sitio_nombre?: string;
  tipo_afectacion?: string;
  horaFallo?: string;
  fechaHoraFallo?: string;
  fechaResolucion?: string;
  horaResolucion?: string;
  fechaHoraResolucion?: string;
  verificacionApertura?: string;
  verificacionAperturaId?: string;
  verificacionCierre?: string;
  verificacionCierreId?: string;
  novedadDetectada?: string;
  ultimo_usuario_edito_id?: number | null;
  ultimo_usuario_edito_nombre?: string | null;
  responsable_verificacion_cierre_id?: number | null;
  responsable_verificacion_cierre_nombre?: string | null;
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

export interface Menu {
  id: number;
  nombre: string;
  icono: string | null;
  ruta: string;
  seccion: string | null;
  orden: number | null;
  activo: boolean;
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
  id: number;
  fecha_evento: string;
  fecha_reaccion: string | null;
  fecha_reaccion_fuera: string | null;
  ubicacion: string;
  sitio_id: number | null;
  sitio_nombre?: string | null;
  tipo: string;
  estado: string;
  descripcion?: string | null;
  llego_alerta: boolean;
  medio_comunicacion_id: number | null;
  medio_comunicacion_descripcion?: string | null;
  conclusion_evento_id: number | null;
  conclusion_evento_descripcion?: string | null;
  sustraccion_material: boolean;
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
  // FIX: Vista para el mantenimiento de consolas.
  AdminConsolas,
  // NEW: Vista para el mantenimiento de roles.
  AdminRoles,
  // NEW: Vista para el mantenimiento de usuarios.
  AdminUsuarios,
  // NEW: Vista para el catálogo de tipos de problema.
  AdminCatalogoTipoProblema,
  // NEW: Vista para la asignación de roles a usuarios.
  AdminAsignacionRoles,
  // NEW: Vista para la asignación de consolas a usuarios.
  AdminAsignacionConsolas,
  // NEW: Vista para administrar la relación entre roles y menús.
  AdminRolMenu,
  // NEW: Vista para el mantenimiento del catálogo de menús.
  AdminMenus,
}

export interface Hacienda {
  id: number;
  nombre: string;
  direccion: string;
  activo: boolean;
  fecha_creacion: string;
}
