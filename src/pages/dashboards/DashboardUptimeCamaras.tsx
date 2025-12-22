import React, { useEffect, useMemo, useState } from 'react';
import {
  DashboardUptimeFilters,
  DashboardUptimeResponse,
  UptimeDetalleRow,
  fetchDashboardUptimeCamaras,
} from '@/services/dashboardUptimeCamarasService';
import { getHaciendasActivas, type HaciendaResumen } from '@/services/haciendas.service';

const numberFormatter = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const formatNumber = (value: number) => numberFormatter.format(value || 0);

const combineDateTime = (date: string, time: string) => {
  if (!date) return 0;
  const sanitizedTime = time || '00:00:00';
  const timestamp = new Date(`${date}T${sanitizedTime}Z`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

type SortKey =
  | 'mes'
  | 'id'
  | 'sitio_afectado_final'
  | 'fecha_fallo'
  | 'hora_fallo'
  | 'fecha_recuperacion'
  | 'hora_recuperacion'
  | 'tiempo_offline_h'
  | 'n_camaras'
  | 'hacienda';

type SortDirection = 'asc' | 'desc';

const DashboardUptimeCamaras: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return formatDateInput(start);
  }, []);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(formatDateInput(today));
  const [selectedHacienda, setSelectedHacienda] = useState<string>('');
  const [haciendas, setHaciendas] = useState<HaciendaResumen[]>([]);

  const [kpis, setKpis] = useState<DashboardUptimeResponse['kpis']>({
    dias: 0,
    camaras: 0,
    t_disponible_h: 0,
    t_caido_h: 0,
    uptime_pct: 0,
  });

  const [detalle, setDetalle] = useState<UptimeDetalleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'fecha_fallo',
    direction: 'desc',
  });

  useEffect(() => {
    getHaciendasActivas()
      .then((data) => setHaciendas(data))
      .catch(() => setHaciendas([]));
  }, []);

  const loadData = async (filters: DashboardUptimeFilters) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardUptimeCamaras(filters);
      setKpis(data.kpis);
      setDetalle(data.detalle ?? []);
      setPage(0);
    } catch (err) {
      console.error('[DashboardUptimeCamaras] Error al cargar datos', err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo cargar la información de uptime de cámaras';
      setError(message);
      setKpis({ dias: 0, camaras: 0, t_disponible_h: 0, t_caido_h: 0, uptime_pct: 0 });
      setDetalle([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({ from: fromDate, to: toDate, haciendaId: selectedHacienda ? Number(selectedHacienda) : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    loadData({ from: fromDate, to: toDate, haciendaId: selectedHacienda ? Number(selectedHacienda) : null });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return '▼▲';
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const sortedDetalle = useMemo(() => {
    if (!sortConfig) return detalle;
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    return [...detalle].sort((a, b) => {
      let aValue: number | string = '';
      let bValue: number | string = '';

      switch (sortConfig.key) {
        case 'mes':
        case 'tiempo_offline_h':
        case 'n_camaras':
          aValue = Number((a as Record<string, unknown>)[sortConfig.key]) || 0;
          bValue = Number((b as Record<string, unknown>)[sortConfig.key]) || 0;
          break;
        case 'fecha_fallo':
        case 'hora_fallo':
          aValue = combineDateTime(a.fecha_fallo, a.hora_fallo);
          bValue = combineDateTime(b.fecha_fallo, b.hora_fallo);
          break;
        case 'fecha_recuperacion':
        case 'hora_recuperacion':
          aValue = combineDateTime(a.fecha_recuperacion, a.hora_recuperacion);
          bValue = combineDateTime(b.fecha_recuperacion, b.hora_recuperacion);
          break;
        default:
          aValue = String((a as Record<string, unknown>)[sortConfig.key] ?? '').toLowerCase();
          bValue = String((b as Record<string, unknown>)[sortConfig.key] ?? '').toLowerCase();
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (aValue === bValue) return 0;
        return aValue > bValue ? direction : -direction;
      }

      return String(aValue).localeCompare(String(bValue), 'es') * direction;
    });
  }, [detalle, sortConfig]);

  const totalPages = useMemo(
    () => (rowsPerPage > 0 ? Math.ceil(sortedDetalle.length / rowsPerPage) : 0),
    [rowsPerPage, sortedDetalle.length],
  );

  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedDetalle.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedDetalle]);

  const uptimeDisponible = formatNumber(kpis.t_disponible_h);
  const uptimeCaido = formatNumber(kpis.t_caido_h);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Dashboard Uptime Cámaras</h1>
          <p className="text-sm text-gray-600">Disponibilidad de cámaras basada en eventos offline registrados.</p>
        </div>
      </header>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Fecha Desde
            <input
              type="date"
              required
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Fecha Hasta
            <input
              type="date"
              required
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Hacienda (opcional)
            <select
              value={selectedHacienda}
              onChange={(e) => setSelectedHacienda(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            >
              <option value="">Todas</option>
              {haciendas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-[#1C2E4A] px-4 py-2 text-white font-semibold hover:bg-[#243b55] transition-colors"
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Aplicar filtros'}
            </button>
          </div>
        </form>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">N° días</p>
          <p className="text-2xl font-bold text-[#1C2E4A]">{formatNumber(kpis.dias)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">N° cámaras</p>
          <p className="text-2xl font-bold text-[#1C2E4A]">{formatNumber(kpis.camaras)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">T. disponible (horas)</p>
          <p className="text-2xl font-bold text-[#1C2E4A]">{uptimeDisponible}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">T. caído (horas)</p>
          <p className="text-2xl font-bold text-[#1C2E4A]">{uptimeCaido}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">% Uptime</p>
          <p className="text-2xl font-bold text-[#1C2E4A]">{formatNumber(kpis.uptime_pct)}%</p>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-[#1C2E4A]">Detalle de caídas</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <label className="flex items-center gap-2">
              <span>Filas por página:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
                className="rounded-md border border-gray-300 px-2 py-1 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span>
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages || 0}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
                disabled={page + 1 >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  ['mes', 'MES'],
                  ['id', 'ID'],
                  ['sitio_afectado_final', 'SITIO_AFECTADO_FINAL'],
                  ['fecha_fallo', 'FECHA_FALLO'],
                  ['hora_fallo', 'HORA_FALLO'],
                  ['fecha_recuperacion', 'FECHA_RECUPERACION'],
                  ['hora_recuperacion', 'HORA_RECUPERACION'],
                  ['tiempo_offline_h', 'TIEMPO_OFFLINE_H'],
                  ['n_camaras', 'N_CAMARAS'],
                  ['hacienda', 'HACIENDA'],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 cursor-pointer"
                    onClick={() => handleSort(key as SortKey)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <span className="text-[10px] text-gray-400">{renderSortIcon(key as SortKey)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">
                    {loading ? 'Cargando datos...' : 'No hay registros para mostrar'}
                  </td>
                </tr>
              )}
              {paginatedRows.map((row) => (
                <tr key={`${row.id}-${row.mes}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700">{row.mes}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.id}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.sitio_afectado_final}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.fecha_fallo}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.hora_fallo}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.fecha_recuperacion}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.hora_recuperacion}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{formatNumber(row.tiempo_offline_h)}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.n_camaras}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.hacienda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardUptimeCamaras;
