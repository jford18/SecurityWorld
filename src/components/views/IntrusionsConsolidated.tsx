import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  fetchIntrusionesConsolidado,
  IntrusionConsolidadoFilters,
  IntrusionConsolidadoResponse,
} from '../../services/intrusionesService';
import { getSitios, Sitio } from '../../services/sitiosService';
import * as tipoIntrusionService from '../../services/tipoIntrusion.service';
import * as personaService from '../../services/persona.service';
import { IntrusionConsolidadoRow } from '../../types';
import {
  formatIntrusionDateTime,
  intrusionesColumns,
} from '@/components/intrusiones/intrusionesColumns';
import DateTimeInput from '../ui/DateTimeInput';
import type { Dayjs } from 'dayjs';

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

const IntrusionsConsolidated: React.FC = () => {
  const [filters, setFilters] = useState<IntrusionConsolidadoFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [data, setData] = useState<IntrusionConsolidadoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof IntrusionConsolidadoRow | null>(
    'fechaHoraIntrusion'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [tiposIntrusion, setTiposIntrusion] = useState<TipoIntrusionItem[]>([]);
  const [personas, setPersonas] = useState<PersonaItem[]>([]);

  const totalPages = useMemo(() => {
    if (!pagination.pageSize) return 1;
    return Math.max(1, Math.ceil(total / pagination.pageSize));
  }, [pagination.pageSize, total]);

  const loadCatalogos = useCallback(async () => {
    try {
      const [sitiosData, tiposDataRaw, personasRaw] = await Promise.all([
        getSitios(),
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

      setSitios(sitiosData ?? []);
      setTiposIntrusion(tiposData ?? []);
      setPersonas(personasData ?? []);
    } catch (catalogError) {
      console.error('Error al cargar los catálogos para el consolidado de intrusiones:', catalogError);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: IntrusionConsolidadoFilters = {
      ...filters,
      page: pagination.page,
      limit: pagination.pageSize,
    };

    try {
      const response = await fetchIntrusionesConsolidado(params);
      const normalizedResponse: IntrusionConsolidadoResponse = {
        data: response.data ?? [],
        total: response.total ?? 0,
        page: response.page ?? pagination.page,
        pageSize: response.pageSize ?? pagination.pageSize,
      };

      setData(normalizedResponse.data);
      setTotal(normalizedResponse.total);

      if (normalizedResponse.page !== pagination.page) {
        setPagination((prev) => ({ ...prev, page: normalizedResponse.page }));
      }
    } catch (requestError) {
      console.error('Error al obtener el consolidado de intrusiones:', requestError);
      setError('No se pudo cargar el consolidado de intrusiones.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void loadCatalogos();
  }, [loadCatalogos]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleFilterChange = (
    field: keyof IntrusionConsolidadoFilters,
    value: string | number | boolean | undefined
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleDateFilterChange = (
    field: 'fechaDesde' | 'fechaHasta',
    _: string | null,
    helpers: { isoString: string | null; dateValue?: Dayjs | null },
  ) => {
    const sanitizedValue = helpers.isoString || undefined;
    handleFilterChange(field, sanitizedValue);
  };

  const handlePageChange = (nextPage: number) => {
    setPagination((prev) => ({ ...prev, page: nextPage }));
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(event.target.value);
    setPagination({ page: 1, pageSize: Number.isNaN(newSize) ? 10 : newSize });
  };

  const handleClearFilters = () => {
    setFilters({});
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSort = (field: keyof IntrusionConsolidadoRow) => {
    setSortField((prevField) => {
      if (prevField !== field) {
        setSortDirection('asc');
        return field;
      }
      setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'));
      return field;
    });
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;

    const multiplier = sortDirection === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      if (sortField === 'fechaHoraIntrusion') {
        const aTime = a.fechaHoraIntrusion ? new Date(a.fechaHoraIntrusion).getTime() : 0;
        const bTime = b.fechaHoraIntrusion ? new Date(b.fechaHoraIntrusion).getTime() : 0;
        return (aTime - bTime) * multiplier;
      }

      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'boolean' || typeof bValue === 'boolean') {
        const aBool = aValue ? 1 : 0;
        const bBool = bValue ? 1 : 0;
        return (aBool - bBool) * multiplier;
      }

      const aText = (aValue ?? '').toString().toLowerCase();
      const bText = (bValue ?? '').toString().toLowerCase();
      return aText.localeCompare(bText) * multiplier;
    });
  }, [data, sortDirection, sortField]);

  const renderSortIndicator = (field: keyof IntrusionConsolidadoRow) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const handleExportToExcel = () => {
    if (isLoading || sortedData.length === 0) return;

    const formattedRows = sortedData.map((row) => ({
      'Fecha y hora de intrusión':
        formatIntrusionDateTime(row.fechaHoraIntrusion) || 'Sin información',
      Sitio: row.sitio || 'Sin información',
      'Tipo intrusión': row.tipoIntrusion || 'Sin información',
      'Llegó alerta': row.llegoAlerta ? 'Sí' : 'No',
      'Personal identificado (Cargo – Persona)': row.personalIdentificado?.trim() || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidado');

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const filename = `consolidado_intrusiones_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Consolidado de Intrusiones</h3>

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
            <label className="block text-sm font-medium text-gray-700">Sitio</label>
            <select
              value={filters.sitioId ?? ''}
              onChange={(e) => handleFilterChange('sitioId', e.target.value)}
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
              onChange={(e) => handleFilterChange('tipoIntrusionId', e.target.value)}
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
              onChange={(e) => handleFilterChange('llegoAlerta', e.target.value)}
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
              onChange={(e) => handleFilterChange('personalId', e.target.value)}
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
            onClick={() => void loadData()}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-[#1C2E4A]">Resultados</h4>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={isLoading || data.length === 0}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-md ${
                isLoading || data.length === 0
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Exportar a Excel
            </button>

            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>
                Página {pagination.page} de {totalPages}
              </span>
              <label className="flex items-center gap-2">
                <span>Filas por página:</span>
                <select
                  value={pagination.pageSize}
                  onChange={handlePageSizeChange}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {intrusionesColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort(column.key as keyof IntrusionConsolidadoRow)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{column.header}</span>
                      <span className="text-xs">{renderSortIndicator(column.key as keyof IntrusionConsolidadoRow)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={intrusionesColumns.length}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    {isLoading ? 'Cargando información...' : 'No hay registros disponibles.'}
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => (
                  <tr key={row.id ?? `${row.sitio}-${row.fechaHoraIntrusion}`} className="hover:bg-gray-50">
                    {intrusionesColumns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-gray-700">
          <span>
            Mostrando {data.length} de {total} resultados
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1 || isLoading}
              className={`px-3 py-2 rounded-md border ${
                pagination.page <= 1 || isLoading
                  ? 'text-gray-400 border-gray-200 bg-gray-50'
                  : 'text-gray-700 border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(Math.min(totalPages, pagination.page + 1))}
              disabled={pagination.page >= totalPages || isLoading}
              className={`px-3 py-2 rounded-md border ${
                pagination.page >= totalPages || isLoading
                  ? 'text-gray-400 border-gray-200 bg-gray-50'
                  : 'text-gray-700 border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntrusionsConsolidated;
