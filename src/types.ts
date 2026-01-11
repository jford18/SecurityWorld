export interface TechnicalFailure {
  id: string;
  fecha: string;
  hora?: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  // Campos nuevos (solo supervisor)
  deptResponsable?: string;
  departamentoResponsableId?: string | number | null;
  encoding_device_id?: number | null;
  encodingDeviceId?: number | null;
  ipSpeakerId?: number | null;
  sitio_nombre?: string;
  sitioNombre?: string;
  sitio?: string;
  tipo_afectacion?: string;
  tipoAfectacion?: string;
  tipo_afectacion_detalle?: string;
  tipoAfectacionDetalle?: string;
  tipo_equipo_afectado?: string;
  tipoEquipoAfectado?: string;
  tipo_equipo_afectado_id?: number | null;
  equipoAfectado?: string;
  horaFallo?: string;
  fecha_hora_fallo?: string;
  fechaHoraFallo?: string;
  problema?: string;
  fechaResolucion?: string;
  horaResolucion?: string;
  fechaHoraResolucion?: string;
  verificacionApertura?: string;
  verificacionAperturaId?: string;
  verificacionCierre?: string;
  verificacionCierreId?: string;
  novedadDetectada?: string;
  novedad?: string;
  tipoProblemaNombre?: string;
  tipoProblema?: string;
  departamentoNombre?: string;
  estado?: string | null;
  estado_texto?: string;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
  ultimo_usuario_edito_id?: number | null;
  ultimo_usuario_edito_nombre?: string | null;
  ultimo_usuario_edito?: string | null;
  responsable_verificacion_cierre_id?: number | null;
  responsable_verificacion_cierre_nombre?: string | null;
  departamento_responsable?: string;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  hacienda_id?: number | null;
  hacienda_nombre?: string | null;
  consola_id?: number | null;
  reportado_cliente?: boolean | string | null;
}

export interface FailureDurationResponse {
  duracionTexto: string;
  totalMinutos: number;
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
}

export interface FailureDepartmentTimelineEntry {
  departamento_id: number;
  departamento_nombre: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_seg: number | null;
  novedad_detectada?: string | null;
  ultimo_usuario_edito_id?: number | null;
  ultimo_usuario_edito_nombre?: string | null;
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
  ip?: string | null;
  proveedor_id?: number | null;
  proveedorId?: number | null;
  proveedor_nombre?: string | null;
  proveedorNombre?: string | null;
}

export interface CatalogoDispositivo {
  id: number;
  nombre: string;
  estado?: string;
  origen_equipo?: string | null;
  origen?: string | null;
  origenEquipo?: string | null;
  esHc?: boolean;
  esHC?: boolean;
  provieneDeHc?: boolean;
  provieneDeHC?: boolean;
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
  origen?: string | null;
  hik_alarm_evento_id?: number | null;
  fecha_evento: string;
  fecha_reaccion: string | null;
  fecha_reaccion_enviada?: string | null;
  fecha_llegada_fuerza_reaccion?: string | null;
  fecha_reaccion_fuera: string | null;
  no_llego_alerta?: boolean;
  completado?: boolean;
  fecha_completado?: string | null;
  necesita_protocolo?: boolean;
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
  fuerza_reaccion_id: number | null;
  fuerza_reaccion_descripcion?: string | null;
  persona_id?: number | null;
  personal_identificado?: string | null;
}

export interface IntrusionHcQueueRow {
  fecha_evento_hc: string | null;
  region: string | null;
  name: string | null;
  trigger_event: string | null;
  status: string | null;
  alarm_category: string | null;
  intrusion_id: number | null;
  completado: boolean;
  hik_alarm_evento_id: number;
  source: string | null;
  alarm_acknowledgment_time: string | null;
}

export interface IntrusionConsolidadoRow {
  id: number | null;
  fechaHoraIntrusion: string | null;
  sitio: string;
  tipoIntrusion: string;
  llegoAlerta: boolean;
  personalIdentificado: string;
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
