import React, { useCallback, useEffect, useState } from 'react';
import DateTimeInput from '../ui/DateTimeInput';
import { IntrusionConsolidadoFilters } from '@/services/intrusionesService';
import { getSitios, Sitio } from '@/services/sitiosService';
import { ClienteResumen, getClientesActivos } from '@/services/clientes.service';
import { HaciendaResumen, getHaciendasActivas } from '@/services/haciendas.service';
import * as tipoIntrusionService from '@/services/tipoIntrusion.service';
import * as personaService from '@/services/persona.service';

interface TipoIntrusionItem {
  id: number;
  descripcion: string;
}

interface PersonaItem {
  id: number;
  nombre: string;
  apellido: string;
  cargo_descripcion?: string;
}

const buildPersonalLabel = (persona?: PersonaItem | null) => {
  if (!persona) return '';

  const nombreCompleto = [persona.nombre, persona.apellido]
    .filter(Boolean)
    .map((value) => value.trim())
    .join(' ');

  if (persona.cargo_descripcion && nombreCompleto) {
    return `${persona.cargo_descripcion} - ${nombreCompleto}`;
  }

  return nombreCompleto;
};

interface IntrusionesFiltersProps {
  filters: IntrusionConsolidadoFilters;
  onFiltersChange: (filters: IntrusionConsolidadoFilters) => void;
  onApply?: () => void;
  onClear?: () => void;
}

const IntrusionesFilters: React.FC<IntrusionesFiltersProps> = ({
  filters,
  onFiltersChange,
  onApply,
  onClear,
}) => {
  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [clientes, setClientes] = useState<ClienteResumen[]>([]);
  const [haciendas, setHaciendas] = useState<HaciendaResumen[]>([]);
  const [tiposIntrusion, setTiposIntrusion] = useState<TipoIntrusionItem[]>([]);
  const [personas, setPersonas] = useState<PersonaItem[]>([]);

  const fetchSitiosByCliente = useCallback(
    async (clienteId?: number | string, haciendaId?: number | string) => {
      try {
        const normalizedParams: { clienteId?: number | string; haciendaId?: number | string } = {};

        if (clienteId !== undefined && clienteId !== null && clienteId !== '') {
          normalizedParams.clienteId = clienteId;
        }

        if (haciendaId !== undefined && haciendaId !== null && haciendaId !== '') {
          normalizedParams.haciendaId = haciendaId;
        }

        const sitiosData = await getSitios(
          Object.keys(normalizedParams).length > 0 ? normalizedParams : undefined
        );
        setSitios(sitiosData ?? []);
      } catch (catalogError) {
        console.error('Error al cargar sitios para el consolidado de intrusiones:', catalogError);
      }
    },
    []
  );

  const loadCatalogos = useCallback(async () => {
    try {
      const [clientesActivos, haciendasActivas, tiposDataRaw, personasRaw] = await Promise.all([
        getClientesActivos(),
        getHaciendasActivas(),
        tipoIntrusionService.getAll({ limit: 200 }),
        personaService.getAll(),
      ]);

      const rawTiposData = (tiposDataRaw as { data?: unknown }).data ?? tiposDataRaw;
      const tiposData = Array.isArray(rawTiposData)
        ? (rawTiposData as TipoIntrusionItem[])
        : [];

      const rawPersonasData = (personasRaw as { data?: unknown }).data ?? personasRaw;
      const personasData = Array.isArray(rawPersonasData)
        ? (rawPersonasData as PersonaItem[])
        : [];

      setClientes(clientesActivos ?? []);
      setHaciendas(haciendasActivas ?? []);
      setTiposIntrusion(tiposData ?? []);
      setPersonas(personasData ?? []);
      await fetchSitiosByCliente();
    } catch (catalogError) {
      console.error('Error al cargar los catálogos para el consolidado de intrusiones:', catalogError);
    }
  }, [fetchSitiosByCliente]);

  useEffect(() => {
    void loadCatalogos();
  }, [loadCatalogos]);

  useEffect(() => {
    void fetchSitiosByCliente(filters.clienteId, filters.haciendaId);
  }, [fetchSitiosByCliente, filters.clienteId, filters.haciendaId]);

  const emitFiltersChange = (
    field: keyof IntrusionConsolidadoFilters,
    value: string | number | boolean | undefined
  ) => {
    const updatedFilters: IntrusionConsolidadoFilters = {
      ...filters,
      [field]: value,
    };

    if (field === 'clienteId' || field === 'haciendaId') {
      updatedFilters.sitioId = '';
    }

    onFiltersChange(updatedFilters);
  };

  const handleDateFilterChange = (
    field: 'fechaDesde' | 'fechaHasta',
    _: string | null,
    helpers: { isoString: string | null; dateValue?: Date | null },
  ) => {
    const sanitizedValue = helpers.isoString || undefined;
    emitFiltersChange(field, sanitizedValue);
  };

  const handleClearFilters = () => {
    onFiltersChange({ haciendaId: '' });
    onClear?.();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DateTimeInput
          label="Fecha desde"
          value={filters.fechaDesde ?? ''}
          onChange={(value, helpers) => handleDateFilterChange('fechaDesde', value, helpers)}
          className="focus:border-blue-500 focus:ring-blue-500"
        />
        <DateTimeInput
          label="Fecha hasta"
          value={filters.fechaHasta ?? ''}
          onChange={(value, helpers) => handleDateFilterChange('fechaHasta', value, helpers)}
          className="focus:border-blue-500 focus:ring-blue-500"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700">Hacienda</label>
          <select
            value={filters.haciendaId ?? ''}
            onChange={(e) => emitFiltersChange('haciendaId', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {haciendas.map((hacienda) => (
              <option key={hacienda.id} value={hacienda.id}>
                {hacienda.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Cliente</label>
          <select
            value={filters.clienteId ?? ''}
            onChange={(e) => emitFiltersChange('clienteId', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Sitio</label>
          <select
            value={filters.sitioId ?? ''}
            onChange={(e) => emitFiltersChange('sitioId', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {sitios.map((sitio) => (
              <option key={sitio.id} value={sitio.id}>
                {sitio.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de intrusión</label>
          <select
            value={filters.tipoIntrusionId ?? ''}
            onChange={(e) => emitFiltersChange('tipoIntrusionId', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {tiposIntrusion.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.descripcion}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Llegó alerta</label>
          <select
            value={filters.llegoAlerta === undefined ? '' : String(filters.llegoAlerta)}
            onChange={(e) => emitFiltersChange('llegoAlerta', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Personal identificado</label>
          <select
            value={filters.personalId ?? ''}
            onChange={(e) => emitFiltersChange('personalId', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {buildPersonalLabel(persona) || 'Sin información'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleClearFilters}
          className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Limpiar filtros
        </button>
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
};

export default IntrusionesFilters;
