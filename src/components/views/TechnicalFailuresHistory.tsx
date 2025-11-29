import React, { useMemo, useState } from 'react';
import { TechnicalFailure } from '../../types';
import { calcularEstado } from './TechnicalFailuresUtils';

const formatFechaHoraFallo = (failure: TechnicalFailure) => {
  if (failure.fechaHoraFallo) {
    return failure.fechaHoraFallo;
  }

  const horaFallo = failure.hora ?? failure.horaFallo;
  if (failure.fecha && horaFallo) {
    return `${failure.fecha} ${horaFallo.toString().substring(0, 5)}`;
  }

  if (failure.fecha) {
    return failure.fecha;
  }

  const dateTimeCandidate = failure.fechaHoraFallo;

  if (!dateTimeCandidate) {
    return '';
  }

  if (!dateTimeCandidate.includes('T')) {
    return dateTimeCandidate;
  }

  const parsed = new Date(dateTimeCandidate);

  if (Number.isNaN(parsed.getTime())) {
    return dateTimeCandidate.replace('T', ' ').replace('Z', '');
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

interface TechnicalFailuresHistoryProps {
  failures: TechnicalFailure[];
  isLoading: boolean;
  activeRole: string | undefined;
  handleEdit?: (failure: TechnicalFailure) => void;
  showActions?: boolean;
}

const TechnicalFailuresHistory: React.FC<TechnicalFailuresHistoryProps> = ({
  failures,
  isLoading,
  activeRole: _activeRole,
  handleEdit,
  showActions = true,
}) => {
  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    problema: '',
    tipoAfectacion: '',
    sitio: '',
    estado: '',
    departamento: '',
  });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const actionsEnabled = showActions && Boolean(handleEdit);
  const columnsCount = actionsEnabled ? 7 : 6;

  const getFechaFalloTimestamp = (failure: TechnicalFailure) => {
    const horaFallo = failure.hora ?? failure.horaFallo;

    if (failure.fecha && horaFallo) {
      const timestamp = new Date(`${failure.fecha}T${horaFallo}`).getTime();
      if (!Number.isNaN(timestamp)) return timestamp;
    }

    if (failure.fecha) {
      const timestamp = new Date(failure.fecha).getTime();
      if (!Number.isNaN(timestamp)) return timestamp;
    }

    const dateTimeCandidate = failure.fechaHoraFallo;
    if (dateTimeCandidate) {
      const normalized = dateTimeCandidate.includes('T')
        ? dateTimeCandidate
        : dateTimeCandidate.replace(' ', 'T');
      const timestamp = new Date(normalized).getTime();
      if (!Number.isNaN(timestamp)) return timestamp;
    }

    return 0;
  };

  const getSortableTextValue = (failure: TechnicalFailure, key: string) => {
    switch (key) {
      case 'problema':
        return (
          failure.problema
            || failure.tipoProblemaNombre
            || failure.tipoProblema
            || failure.descripcion_fallo
            || ''
        )
          .toString()
          .toLowerCase();
      case 'tipoAfectacion': {
        const tipoAfectacion = failure.tipoAfectacion || failure.tipo_afectacion || '';
        return tipoAfectacion.toString().toLowerCase();
      }
      case 'sitioNombre':
        return (failure.sitio || failure.sitioNombre || failure.sitio_nombre || '')
          .toString()
          .toLowerCase();
      case 'estado': {
        const estado = failure.estado_texto || calcularEstado(failure).texto;
        return estado.toLowerCase();
      }
      case 'departamentoResponsable':
        return (
          failure.departamento_responsable
            ||
          failure.departamentoNombre
            || failure.deptResponsable
            || ''
        )
          .toString()
          .toLowerCase();
      default:
        return '';
    }
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = (items: TechnicalFailure[]) => {
    const fechaDesdeTs = filters.fechaDesde ? new Date(filters.fechaDesde).getTime() : null;
    const fechaHastaTs = filters.fechaHasta ? new Date(filters.fechaHasta).getTime() : null;

    return items.filter((item) => {
      const problemaTexto = getSortableTextValue(item, 'problema');
      const tipoAfectacionTexto = getSortableTextValue(item, 'tipoAfectacion');
      const sitioTexto = getSortableTextValue(item, 'sitioNombre');
      const estadoTexto = getSortableTextValue(item, 'estado');
      const departamentoTexto = getSortableTextValue(item, 'departamentoResponsable');

      if (filters.problema && !problemaTexto.includes(filters.problema.toLowerCase())) {
        return false;
      }

      if (filters.tipoAfectacion && tipoAfectacionTexto !== filters.tipoAfectacion.toLowerCase()) {
        return false;
      }

      if (filters.sitio && !sitioTexto.includes(filters.sitio.toLowerCase())) {
        return false;
      }

      if (filters.estado && !estadoTexto.includes(filters.estado.toLowerCase())) {
        return false;
      }

      if (filters.departamento && !departamentoTexto.includes(filters.departamento.toLowerCase())) {
        return false;
      }

      const falloTimestamp = getFechaFalloTimestamp(item);
      if (fechaDesdeTs && (falloTimestamp === 0 || falloTimestamp < fechaDesdeTs)) {
        return false;
      }

      if (fechaHastaTs && (falloTimestamp === 0 || falloTimestamp > fechaHastaTs)) {
        return false;
      }

      return true;
    });
  };

  const applySort = (
    items: TechnicalFailure[],
    config: { key: string; direction: 'asc' | 'desc' } | null,
  ) => {
    if (!config) return items;

    const sorted = [...items].sort((a, b) => {
      const directionMultiplier = config.direction === 'asc' ? 1 : -1;

      if (config.key === 'fechaFallo') {
        const aTime = getFechaFalloTimestamp(a);
        const bTime = getFechaFalloTimestamp(b);
        if (aTime === bTime) return 0;
        return aTime > bTime ? directionMultiplier : -directionMultiplier;
      }

      const aValue = getSortableTextValue(a, config.key);
      const bValue = getSortableTextValue(b, config.key);
      return aValue.localeCompare(bValue) * directionMultiplier;
    });

    return sorted;
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortedFailures = useMemo(
    () => applySort(applyFilters(failures), sortConfig),
    [failures, sortConfig, filters],
  );

  const tipoAfectacionOptions = useMemo(() => {
    const values = new Set<string>();
    failures.forEach((item) => {
      const text = getSortableTextValue(item, 'tipoAfectacion');
      if (text) values.add(text);
    });
    return Array.from(values).sort();
  }, [failures]);

  const departamentoOptions = useMemo(() => {
    const values = new Set<string>();
    failures.forEach((item) => {
      const text = getSortableTextValue(item, 'departamentoResponsable');
      if (text) values.add(text);
    });
    return Array.from(values).sort();
  }, [failures]);

  const handleClearFilters = () => {
    setFilters({
      fechaDesde: '',
      fechaHasta: '',
      problema: '',
      tipoAfectacion: '',
      sitio: '',
      estado: '',
      departamento: '',
    });
  };

  const renderSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Fallos Recientes</h4>
        <div className="flex items-center gap-3">
          {isLoading && <span className="text-sm text-gray-500">Cargando información...</span>}
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      </div>
      <div className="overflow-x-auto relative">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('fechaFallo')}
              >
                Fecha y Hora de Fallo{renderSortIndicator('fechaFallo')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('problema')}
              >
                Problema{renderSortIndicator('problema')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('tipoAfectacion')}
              >
                Tipo de Afectación{renderSortIndicator('tipoAfectacion')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('sitioNombre')}
              >
                Sitio{renderSortIndicator('sitioNombre')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('estado')}
              >
                Estado{renderSortIndicator('estado')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('departamentoResponsable')}
              >
                Departamento Responsable{renderSortIndicator('departamentoResponsable')}
              </th>
              {actionsEnabled && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Acciones
                </th>
              )}
            </tr>
            <tr>
              <th className="px-6 py-2">
                <div className="flex flex-col gap-1 text-xs text-gray-700">
                  <input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(e) => handleFilterChange('fechaDesde', e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="Desde"
                  />
                  <input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(e) => handleFilterChange('fechaHasta', e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="Hasta"
                  />
                </div>
              </th>
              <th className="px-6 py-2">
                <input
                  type="text"
                  value={filters.problema}
                  onChange={(e) => handleFilterChange('problema', e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                  placeholder="Filtrar problema"
                />
              </th>
              <th className="px-6 py-2">
                <select
                  value={filters.tipoAfectacion}
                  onChange={(e) => handleFilterChange('tipoAfectacion', e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                >
                  <option value="">Todos</option>
                  {tipoAfectacionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.toUpperCase()}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-6 py-2">
                <input
                  type="text"
                  value={filters.sitio}
                  onChange={(e) => handleFilterChange('sitio', e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                  placeholder="Filtrar sitio"
                />
              </th>
              <th className="px-6 py-2">
                <select
                  value={filters.estado}
                  onChange={(e) => handleFilterChange('estado', e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                >
                  <option value="">Todos</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </th>
              <th className="px-6 py-2">
                <select
                  value={filters.departamento}
                  onChange={(e) => handleFilterChange('departamento', e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                >
                  <option value="">Todos</option>
                  {departamentoOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.toUpperCase()}
                    </option>
                  ))}
                </select>
              </th>
              {actionsEnabled && <th className="px-6 py-2" />}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedFailures.length === 0 ? (
              <tr>
                <td colSpan={columnsCount} className="px-6 py-4 text-center text-sm text-gray-500">
                  {isLoading ? 'Cargando fallos técnicos...' : 'No hay registros disponibles.'}
                </td>
              </tr>
            ) : (
              sortedFailures.map((fallo) => (
                <tr key={fallo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFechaHoraFallo(fallo) || 'Sin información'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.problema
                      || fallo.tipoProblemaNombre
                      || fallo.tipoProblema
                      || fallo.descripcion_fallo
                      || 'Sin información'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.tipo_afectacion
                      || fallo.tipoAfectacion
                      || 'Sin información'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.sitio
                      || fallo.sitioNombre
                      || fallo.sitio_nombre
                      || 'Sin sitio asignado'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(() => {
                      const estado = calcularEstado(fallo);
                      return (
                        <span
                          style={{
                            backgroundColor: estado.color,
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.9em',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            minWidth: '110px',
                            textAlign: 'center',
                          }}
                        >
                          {estado.texto}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.departamento_responsable
                      || fallo.departamentoNombre
                      || fallo.deptResponsable
                      || 'Sin información'}
                  </td>
                  {actionsEnabled && handleEdit && (
                    <td className="px-6 py-3 text-left whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(fallo)}
                        className="text-blue-600 hover:underline text-sm font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TechnicalFailuresHistory;
