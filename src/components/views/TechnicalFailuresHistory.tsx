import React, { useMemo, useState } from 'react';
import { TechnicalFailure } from '../../types';
import { calcularEstado } from './TechnicalFailuresUtils';
import {
  exportFallosTecnicosConsultasExcel,
  FallosExportFilters,
} from '../../services/fallosService';
import { getLocalDateTimestamp, parseDbTimestampToLocal } from '../../utils/datetime';

interface TechnicalFailuresHistoryProps {
  failures: TechnicalFailure[];
  isLoading: boolean;
  activeRole: string | undefined;
  handleEdit?: (failure: TechnicalFailure) => void;
  showActions?: boolean;
  enableExport?: boolean;
  exportFilters?: FallosExportFilters;
  renderActions?: (failure: TechnicalFailure) => React.ReactNode;
  withContainer?: boolean;
}

const TechnicalFailuresHistory: React.FC<TechnicalFailuresHistoryProps> = ({
  failures,
  isLoading,
  handleEdit,
  showActions = true,
  enableExport = false,
  exportFilters,
  renderActions,
  withContainer = true,
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
  const [isExporting, setIsExporting] = useState(false);
  const actionsEnabled = showActions && Boolean(handleEdit || renderActions);
  const stickyActions = actionsEnabled;
  const columnsCount = actionsEnabled ? 12 : 11;

  const getFechaFalloTimestamp = (failure: TechnicalFailure) => {
    const horaFallo = failure.hora ?? failure.horaFallo;

    if (failure.fecha && horaFallo) {
      const timestamp = getLocalDateTimestamp(`${failure.fecha} ${horaFallo}`);
      if (timestamp !== null) return timestamp;
    }

    if (failure.fecha) {
      const timestamp = getLocalDateTimestamp(failure.fecha);
      if (timestamp !== null) return timestamp;
    }

    const dateTimeCandidate = failure.fechaHoraFallo;
    if (dateTimeCandidate) {
      const timestamp = getLocalDateTimestamp(dateTimeCandidate);
      if (timestamp !== null) return timestamp;
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
        const tipoAfectacion =
          failure.tipo_afectacion_detalle
          || failure.tipoAfectacionDetalle
          || failure.tipoAfectacion
          || failure.tipo_afectacion
          || '';
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

  const getTipoAfectacionLabel = (failure: TechnicalFailure) => {
    const detalle = failure.tipo_afectacion_detalle || failure.tipoAfectacionDetalle;
    if (detalle != null && String(detalle).trim() !== '') {
      return String(detalle);
    }

    const tipoBase = (failure.tipoAfectacion || failure.tipo_afectacion || '').toString().trim();
    if (!tipoBase) {
      return 'Sin información';
    }

    const tipoNormalizado = tipoBase.toUpperCase();
    if (tipoNormalizado === 'EQUIPO') {
      const tipoEquipo = (
        failure.tipo_equipo_afectado
        || failure.tipoEquipoAfectado
        || ''
      )
        .toString()
        .trim();
      return tipoEquipo ? `EQUIPO-${tipoEquipo}` : 'EQUIPO';
    }

    return tipoNormalizado;
  };

  const isFailureResolved = (failure: TechnicalFailure) => {
    const estadoBase =
      failure.estado
      ?? failure.estado_texto
      ?? calcularEstado(failure).texto
      ?? '';
    const estadoNorm = String(estadoBase).trim().toUpperCase();
    return estadoNorm === 'RESUELTO' || estadoNorm.startsWith('RESUELT');
  };

  const isTipoAfectacionEquipo = (failure: TechnicalFailure) => {
    const tipoAfectacion = (failure.tipoAfectacion || failure.tipo_afectacion || '').toString().trim().toUpperCase();
    return tipoAfectacion === 'EQUIPO';
  };

  const getTipoEquipoAfectado = (failure: TechnicalFailure) => {
    const record = failure as TechnicalFailure & {
      tipo_equipo_afectado?: string | null;
      tipoEquipoAfectado?: string | null;
    };

    return (record.tipo_equipo_afectado ?? record.tipoEquipoAfectado ?? '').toString().trim();
  };

  const getNombreEquipo = (failure: TechnicalFailure) => {
    const record = failure as TechnicalFailure & {
      NOMBRE_EQUIPO?: string;
      nombre_equipo?: string;
      nombreEquipo?: string;
      EQUIPO_AFECTADO?: string;
      equipo_afectado?: string;
      equipoAfectado?: string;
    };
    const nombre =
      record.NOMBRE_EQUIPO
      ?? record.nombre_equipo
      ?? record.nombreEquipo
      ?? record.EQUIPO_AFECTADO
      ?? record.equipo_afectado
      ?? record.equipoAfectado
      ?? '';
    const trimmed = nombre.trim();
    return trimmed;
  };

  const getDuracionTotalFalloHoras = (failure: TechnicalFailure) => {
    const record = failure as Record<string, unknown>;
    const duracionSegKeys = [
      'duracion_total_fallo_seg',
      'duracionTotalFalloSeg',
      'duracion_total_segundos',
      'duracionSegundos',
    ];

    for (const key of duracionSegKeys) {
      const value = record[key];
      if (value === null || value === undefined || value === '') continue;
      const segundos = Number(value);
      if (Number.isFinite(segundos) && segundos >= 0) {
        return (segundos / 3600).toFixed(2);
      }
    }

    const inicioBase = failure.fecha_hora_fallo || failure.fechaHoraFallo;
    const inicio = inicioBase ? new Date(inicioBase) : null;
    if (!inicio || Number.isNaN(inicio.getTime())) return '-';

    const finBase =
      failure.fechaHoraResolucion
      || (record.fecha_hora_resolucion as string | undefined)
      || failure.fecha_actualizacion
      || null;
    const fin = finBase ? new Date(finBase) : new Date();
    if (Number.isNaN(fin.getTime())) return '-';

    const segundosCalculados = Math.max(0, (fin.getTime() - inicio.getTime()) / 1000);
    return (segundosCalculados / 3600).toFixed(2);
  };

  const formatFechaActualizacion = (failure: TechnicalFailure) => {
    const value = failure.fecha_actualizacion;
    if (!value) return '-';
    const parsed = parseDbTimestampToLocal(value) || new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
  };

  const handleExportToExcel = async () => {
    if (isLoading || isExporting || sortedFailures.length === 0) return;

    setIsExporting(true);

    try {
      const params = {
        ...exportFilters,
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        problema: filters.problema,
        tipoAfectacion: filters.tipoAfectacion,
        sitio: filters.sitio,
        estado: filters.estado,
        departamento: filters.departamento,
      };

      const { blob, filename } = await exportFallosTecnicosConsultasExcel(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar fallos técnicos:', error);
      alert('No se pudo exportar el Excel de fallos técnicos.');
    } finally {
      setIsExporting(false);
    }
  };

  const actionHeaderClasses = stickyActions
    ? 'sticky right-0 z-40 bg-white min-w-[110px] w-[110px] border-l shadow-[-6px_0_6px_rgba(0,0,0,0.06)]'
    : '';
  const actionCellClasses = stickyActions
    ? 'sticky right-0 z-30 bg-white min-w-[110px] w-[110px] border-l shadow-[-6px_0_6px_rgba(0,0,0,0.06)]'
    : '';

  const content = (
    <>
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
          {enableExport && (
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={isLoading || isExporting || sortedFailures.length === 0}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-md ${
                isLoading || isExporting || sortedFailures.length === 0
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isExporting ? 'Exportando...' : 'Exportar a Excel'}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto relative max-w-full isolate">
        <table className="min-w-max w-full border-separate border-spacing-0 divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('estado')}
              >
                Estado{renderSortIndicator('estado')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('tipoAfectacion')}
              >
                Tipo de Afectación{renderSortIndicator('tipoAfectacion')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('problema')}
              >
                Problema{renderSortIndicator('problema')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('sitioNombre')}
              >
                Sitio{renderSortIndicator('sitioNombre')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duración total del fallo (H)
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('departamentoResponsable')}
              >
                Departamento Responsable{renderSortIndicator('departamentoResponsable')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo de equipo afectado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre del equipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detalle de novedad detectada
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Responsable inicial
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Último usuario que editó
              </th>
              {actionsEnabled && (
                <th
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${actionHeaderClasses}`}
                >
                  Acción
                </th>
              )}
            </tr>
            <tr>
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
                  value={filters.problema}
                  onChange={(e) => handleFilterChange('problema', e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                  placeholder="Filtrar problema"
                />
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
              <th className="px-6 py-2" />
              <th className="px-6 py-2" />
              <th className="px-6 py-2" />
              {actionsEnabled && <th className={`px-6 py-2 ${actionHeaderClasses}`} />}
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
                    {getTipoAfectacionLabel(fallo) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.problema
                      || fallo.tipoProblemaNombre
                      || fallo.tipoProblema
                      || fallo.descripcion_fallo
                      || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.sitio || fallo.sitioNombre || fallo.sitio_nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getDuracionTotalFalloHoras(fallo)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.departamento_responsable
                      || fallo.departamentoNombre
                      || fallo.deptResponsable
                      || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {isTipoAfectacionEquipo(fallo) ? (getTipoEquipoAfectado(fallo) || '-') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {isTipoAfectacionEquipo(fallo) ? (getNombreEquipo(fallo) || '-') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.novedadDetectada || fallo.novedad_detectada || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.responsable || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {[
                      formatFechaActualizacion(fallo),
                      fallo.ultimo_usuario_edito_nombre
                        ?? (fallo.ultimo_usuario_edito_id != null ? String(fallo.ultimo_usuario_edito_id) : '-'),
                    ]
                      .filter((part) => part && part !== '-')
                      .join(' - ') || '-'}
                  </td>
                  {actionsEnabled && (
                    <td className={`px-6 py-3 text-left whitespace-nowrap ${actionCellClasses}`}>
                      {renderActions ? (
                        renderActions(fallo)
                      ) : (
                        handleEdit && (
                          !isFailureResolved(fallo) && (
                            <button
                              onClick={() => handleEdit(fallo)}
                              className="text-blue-600 hover:underline text-sm font-semibold"
                            >
                              Editar
                            </button>
                          )
                        )
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  if (!withContainer) {
    return content;
  }

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      {content}
    </div>
  );
};

export default TechnicalFailuresHistory;
