import api from './api';

const extractData = <T>(payload: unknown): T | null => {
  if (!payload || typeof payload !== 'object') {
    return Array.isArray(payload) ? (payload as T) : null;
  }

  if ('data' in payload) {
    const dataValue = (payload as { data: T }).data;
    return (dataValue ?? null) as T | null;
  }

  return payload as T;
};

const buildCollectionResponse = <T>(data: unknown): T[] => {
  const resolved = extractData<T[] | undefined>(data);
  if (!resolved) {
    return [];
  }
  return Array.isArray(resolved) ? resolved : [];
};

export interface ClientePersonaRelation {
  id: number;
  cliente_id: number;
  persona_id: number;
  fecha_asignacion: string;
  nombre?: string;
  apellido?: string;
  cargo_id?: number;
  cargo_descripcion?: string;
  estado?: boolean;
}

export interface PersonaDisponible {
  id: number;
  nombre: string;
  apellido: string;
  cargo_id: number;
  cargo_descripcion?: string;
}

export const getPersonasByCliente = async (
  clienteId: number | string
): Promise<ClientePersonaRelation[]> => {
  const { data } = await api.get(`/api/clientes/${clienteId}/personas`);
  return buildCollectionResponse<ClientePersonaRelation>(data);
};

export const addPersonaToCliente = async (
  clienteId: number | string,
  personaId: number | string
): Promise<ClientePersonaRelation | null> => {
  const { data } = await api.post(`/api/clientes/${clienteId}/personas`, {
    persona_id: personaId,
  });
  return extractData<ClientePersonaRelation>(data);
};

export const removePersonaFromCliente = async (
  clienteId: number | string,
  personaId: number | string
): Promise<ClientePersonaRelation | null> => {
  const { data } = await api.delete(
    `/api/clientes/${clienteId}/personas/${personaId}`
  );
  return extractData<ClientePersonaRelation>(data);
};

export const getPersonasDisponiblesParaCliente = async (
  clienteId: number | string
): Promise<PersonaDisponible[]> => {
  const { data } = await api.get(
    `/api/persona/disponibles-para-cliente/${clienteId}`
  );
  return buildCollectionResponse<PersonaDisponible>(data);
};
