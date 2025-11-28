import React, { useMemo, useState } from 'react';
import { TechnicalFailure } from '../../types';
import { calcularEstado } from './TechnicalFailuresUtils';

const formatFechaHoraFallo = (failure: TechnicalFailure) => {
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
          failure.tipoProblemaNombre
            || failure.tipoProblema
            || failure.descripcion_fallo
            || ''
        )
          .toString()
          .toLowerCase();
      case 'tipoAfectacion': {
        const tipoAfectacion = failure.tipoAfectacion || failure.tipo_afectacion;
        const equipo = failure.equipoAfectado || failure.equipo_afectado;
        const value =
          tipoAfectacion === 'EQUIPO' && equipo
            ? `EQUIPO-${equipo}`
            : tipoAfectacion || '';
        return value.toString().toLowerCase();
      }
      case 'sitioNombre':
        return (failure.sitioNombre || failure.sitio_nombre || '')
          .toString()
          .toLowerCase();
      case 'estado': {
        const estado = calcularEstado(failure);
        return estado.texto.toLowerCase();
      }
      case 'departamentoResponsable':
        return (
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
    () => applySort(failures, sortConfig),
    [failures, sortConfig],
  );

  const renderSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Fallos Recientes</h4>
        {isLoading && <span className="text-sm text-gray-500">Cargando información...</span>}
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
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {failures.length === 0 ? (
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
                    {fallo.tipoProblemaNombre
                      || fallo.tipoProblema
                      || fallo.descripcion_fallo
                      || 'Sin información'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(() => {
                      const tipoAfectacion = fallo.tipoAfectacion || fallo.tipo_afectacion;
                      const equipo = fallo.equipoAfectado || fallo.equipo_afectado;
                      return tipoAfectacion === 'EQUIPO' && equipo
                        ? `EQUIPO-${equipo}`
                        : tipoAfectacion || 'Sin información';
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.sitioNombre || fallo.sitio_nombre || 'Sin información'}
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
                    {fallo.departamentoNombre
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
