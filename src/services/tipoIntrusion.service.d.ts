export interface TipoIntrusionDTO {
  id: number;
  descripcion: string;
  activo?: boolean;
  necesita_protocolo?: boolean;
  fecha_creacion?: string;
}

export interface TipoIntrusionQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

declare module './tipoIntrusion.service.js' {
  export function getAll(
    params?: TipoIntrusionQueryParams
  ): Promise<TipoIntrusionDTO[]>;
  export function getById(id: number | string): Promise<TipoIntrusionDTO>;
  export function create(
    payload: Partial<TipoIntrusionDTO>
  ): Promise<TipoIntrusionDTO>;
  export function update(
    id: number | string,
    payload: Partial<TipoIntrusionDTO>
  ): Promise<TipoIntrusionDTO>;
  export function remove(
    id: number | string
  ): Promise<{ id: number } | { mensaje?: string }>;
}
