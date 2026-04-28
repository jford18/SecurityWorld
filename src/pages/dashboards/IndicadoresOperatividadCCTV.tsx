import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleX,
  Clock3,
  Database,
  FileSpreadsheet,
  Info,
  Server,
  Workflow,
  X,
} from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
  exportOperatividadExcel,
  getOperatividadDetalle,
  getOperatividadFiltros,
  getOperatividadReincidencia,
  getOperatividadResumen,
  getOperatividadUptimeCliente,
  getOperatividadUptimeDia,
  type OperatividadDetalleRow,
  type OperatividadFiltrosResponse,
  type OperatividadFilters,
  type OperatividadReincidenciaRow,
  type OperatividadResumen,
  type OperatividadUptimeClienteRow,
  type OperatividadUptimeDiaRow,
} from '@/services/indicadoresOperatividadCctvService';

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const numberFormatter = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
const intFormatter = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 });
const shortDateFormatter = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' });
const donutColors = ['#1C2E4A', '#445C7F', '#6B7F9E', '#8EA0B8', '#A8B6C8', '#C0CBD8', '#D7DFE8'];

const toLabelDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return shortDateFormatter.format(parsed);
};

const getWeekFromDate = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
};

const defaultResumen: OperatividadResumen = {
  total_camaras: 0,
  camaras_online: 0,
  camaras_offline: 0,
  tiempo_disponible_horas: 0,
  total_hours_online: 0,
  total_hours_offline: 0,
  uptime_pct: 0,
  times_offline: 0,
};

const IndicadoresOperatividadCCTV: React.FC = () => {
  const now = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const past = new Date();
    past.setDate(past.getDate() - 6);
    return formatDateInput(past);
  }, []);

  const [filters, setFilters] = useState<OperatividadFilters>({
    fechaDesde: initialFrom,
    fechaHasta: formatDateInput(now),
    cliente: '',
    haciendaSitio: '',
    area: '',
    name: '',
  });
  const [semanaAnalisis, setSemanaAnalisis] = useState('');
  const [timesOfflineMin, setTimesOfflineMin] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [filtrosCatalogo, setFiltrosCatalogo] = useState<OperatividadFiltrosResponse>({
    cliente: [],
    haciendaSitio: [],
    area: [],
    cameraName: [],
  });

  const [resumen, setResumen] = useState<OperatividadResumen>(defaultResumen);
  const [detalle, setDetalle] = useState<OperatividadDetalleRow[]>([]);
  const [uptimeCliente, setUptimeCliente] = useState<OperatividadUptimeClienteRow[]>([]);
  const [uptimeDia, setUptimeDia] = useState<OperatividadUptimeDiaRow[]>([]);
  const [reincidencia, setReincidencia] = useState<OperatividadReincidenciaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryFilters = useMemo(
    () => ({
      ...filters,
      cliente: filters.cliente || undefined,
      haciendaSitio: filters.haciendaSitio || undefined,
      area: filters.area || undefined,
      name: filters.name || undefined,
    }),
    [filters],
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [filtrosResponse, resumenResponse, detalleResponse, uptimeClienteResponse, uptimeDiaResponse, reincidenciaResponse] =
        await Promise.all([
          getOperatividadFiltros(queryFilters),
          getOperatividadResumen(queryFilters),
          getOperatividadDetalle(queryFilters),
          getOperatividadUptimeCliente(queryFilters),
          getOperatividadUptimeDia(queryFilters),
          getOperatividadReincidencia(queryFilters),
        ]);

      setFiltrosCatalogo(filtrosResponse);
      setResumen({ ...defaultResumen, ...resumenResponse });
      setDetalle(detalleResponse);
      setUptimeCliente(uptimeClienteResponse);
      setUptimeDia(uptimeDiaResponse);
      setReincidencia(reincidenciaResponse);
    } catch (err) {
      console.error('[Operatividad CCTV] Error cargando datos', err);
      setError('No se pudo cargar la información del dashboard de operatividad CCTV.');
      setResumen(defaultResumen);
      setDetalle([]);
      setUptimeCliente([]);
      setUptimeDia([]);
      setReincidencia([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApplyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    loadData();
  };

  const onExportExcel = async () => {
    try {
      await exportOperatividadExcel(queryFilters);
    } catch (err) {
      console.error('[Operatividad CCTV] Error exportando Excel', err);
      setError('No se pudo exportar el archivo Excel.');
    }
  };

  const detalleFiltrado = useMemo(() => {
    const minTimesOffline = timesOfflineMin === '' ? null : Number(timesOfflineMin);
    const week = semanaAnalisis === '' ? null : Number(semanaAnalisis);

    return detalle.filter((row) => {
      const passTimes = minTimesOffline == null || Number(row.times_offline || 0) >= minTimesOffline;
      const passWeek =
        week == null ||
        getWeekFromDate(row.auto_check_time) === week ||
        getWeekFromDate(filters.fechaDesde) === week ||
        getWeekFromDate(filters.fechaHasta) === week;
      return passTimes && passWeek;
    });
  }, [detalle, filters.fechaDesde, filters.fechaHasta, semanaAnalisis, timesOfflineMin]);

  const chartUptimeCliente = useMemo(
    () =>
      uptimeCliente.map((item) => ({
        cliente: item.cliente,
        uptime: Number(item.uptime_pct || 0),
        offline: Number(item.total_hours_offline || 0),
        online: Number(item.total_hours_online || 0),
      })),
    [uptimeCliente],
  );

  const chartUptimeDia = useMemo(
    () =>
      uptimeDia.map((item) => ({
        dia: toLabelDate(item.day),
        uptime: Number(item.uptime_pct || 0),
      })),
    [uptimeDia],
  );

  const chartReincidencia = useMemo(
    () =>
      reincidencia
        .map((item) => ({
          camera: item.name,
          times: Number(item.times_offline_7d || 0),
        }))
        .filter((item) => item.times > 2)
        .sort((a, b) => b.times - a.times)
        .slice(0, 15),
    [reincidencia],
  );

  const donutData = useMemo(() => {
    const grouped = new Map<string, number>();
    detalleFiltrado.forEach((row) => {
      const key = row.hacienda_sitio || 'SIN HACIENDA-SITIO';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    const sorted = Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top = sorted.slice(0, 10);
    const others = sorted.slice(10).reduce((acc, curr) => acc + curr.value, 0);
    return others > 0 ? [...top, { name: 'Otros', value: others }] : top;
  }, [detalleFiltrado]);

  const resumenTopAreas = useMemo(() => {
    const grouped = new Map<string, { cliente: string; hacienda: string; area: string; offline: number; times: number }>();
    detalleFiltrado.forEach((row) => {
      const key = `${row.cliente}__${row.hacienda_sitio}__${row.area}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.offline += Number(row.total_hours_offline || 0);
        prev.times += Number(row.times_offline || 0);
        return;
      }
      grouped.set(key, {
        cliente: row.cliente,
        hacienda: row.hacienda_sitio,
        area: row.area,
        offline: Number(row.total_hours_offline || 0),
        times: Number(row.times_offline || 0),
      });
    });
    return Array.from(grouped.values())
      .sort((a, b) => b.offline - a.offline)
      .slice(0, 8);
  }, [detalleFiltrado]);

  const rankingUptimeArea = useMemo(
    () =>
      detalleFiltrado
        .map((row) => ({ area: row.area || row.name, uptime: Number(row.uptime_pct || 0) }))
        .sort((a, b) => a.uptime - b.uptime)
        .slice(0, 30),
    [detalleFiltrado],
  );

  const detalleTop100 = useMemo(() => detalleFiltrado.slice(0, 100), [detalleFiltrado]);

  const totalesDetalle = useMemo(
    () =>
      detalleFiltrado.reduce(
        (acc, row) => {
          acc.totalHoursOffline += Number(row.total_hours_offline || 0);
          acc.totalTimesOffline += Number(row.times_offline || 0);
          return acc;
        },
        { totalHoursOffline: 0, totalTimesOffline: 0 },
      ),
    [detalleFiltrado],
  );

  return (
    <div className="space-y-3 bg-[#F5F6F8] p-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Indicadores de Operatividad CCTV</h1>
          <p className="text-sm text-gray-600">Departamento Técnico</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowInfoModal(true)}
            className="h-9 rounded-md border border-[#1C2E4A] px-3 text-xs font-semibold text-[#1C2E4A]"
          >
            ¿Cómo se extrae esta información?
          </button>
          <img
            src="https://www.swsecurityworld.com/wp-content/uploads/2018/08/Security-World-logo-1.png"
            alt="SecurityWorld"
            className="h-8 w-auto"
          />
        </div>
      </header>

      <section className="rounded-lg bg-white p-3 shadow-sm">
        <form className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8" onSubmit={onApplyFilters}>
          <label className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Cliente</p>
            <select
              value={filters.cliente}
              onChange={(event) => setFilters((prev) => ({ ...prev, cliente: event.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs"
            >
              <option value="">Todos</option>
              {filtrosCatalogo.cliente.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <SearchableSelect
            label="Hacienda-Sitio"
            value={filters.haciendaSitio || ''}
            options={filtrosCatalogo.haciendaSitio.map((item) => ({ value: item, label: item }))}
            onChange={(value) => setFilters((prev) => ({ ...prev, haciendaSitio: value }))}
            loading={loading}
          />

          <SearchableSelect
            label="Area"
            value={filters.area || ''}
            options={filtrosCatalogo.area.map((item) => ({ value: item, label: item }))}
            onChange={(value) => setFilters((prev) => ({ ...prev, area: value }))}
            loading={loading}
          />

          <SearchableSelect
            label="Cámara / Name"
            value={filters.name || ''}
            options={filtrosCatalogo.cameraName.map((item) => ({ value: item, label: item }))}
            onChange={(value) => setFilters((prev) => ({ ...prev, name: value }))}
            loading={loading}
          />

          <label className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Fecha Desde</p>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={(event) => setFilters((prev) => ({ ...prev, fechaDesde: event.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs"
            />
          </label>

          <label className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Fecha Hasta</p>
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={(event) => setFilters((prev) => ({ ...prev, fechaHasta: event.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs"
            />
          </label>

          <label className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Semana de análisis</p>
            <input
              type="number"
              min={1}
              max={53}
              value={semanaAnalisis}
              onChange={(event) => setSemanaAnalisis(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs"
              placeholder="Todas"
            />
          </label>

          <label className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Times Offline</p>
            <input
              type="number"
              min={0}
              value={timesOfflineMin}
              onChange={(event) => setTimesOfflineMin(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-2 text-xs"
              placeholder="Sin mínimo"
            />
          </label>

          <button type="submit" className="h-9 rounded-md bg-[#1C2E4A] px-3 text-xs font-semibold text-white">
            {loading ? 'Cargando...' : 'Aplicar filtros'}
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            className="h-9 rounded-md border border-[#1C2E4A] px-3 text-xs font-semibold text-[#1C2E4A]"
          >
            Exportar Excel
          </button>
        </form>
        {error ? <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">% Up Time por Cliente</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartUptimeCliente}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="cliente" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `${numberFormatter.format(Number(value))}%`} />
                <Bar dataKey="uptime" fill="#1C2E4A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Offline vs Online por Cliente</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartUptimeCliente} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="cliente" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(value) => numberFormatter.format(Number(value))} />
                <Bar dataKey="offline" fill="#334155" name="Total Hours Offline" />
                <Bar dataKey="online" fill="#94A3B8" name="Total Hours Online" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Distribución por Hacienda-Sitio</h3>
          <div className="flex h-[260px] gap-2">
            <div className="min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} innerRadius={50} outerRadius={86} dataKey="value" nameKey="name" labelLine={false}>
                    {donutData.map((entry, index) => (
                      <Cell key={entry.name} fill={donutColors[index % donutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => intFormatter.format(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-[122px] overflow-auto pr-1">
              <ul className="space-y-1">
                {donutData.map((entry, index) => (
                  <li key={`legend-${entry.name}`} className="flex items-center gap-1.5 text-[10px] text-slate-700">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: donutColors[index % donutColors.length] }}
                    />
                    <span className="truncate">{entry.name}</span>
                    <span className="ml-auto shrink-0 font-semibold text-slate-900">{intFormatter.format(entry.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Top Áreas/Cámaras por Offline</h3>
          <div className="h-[260px] overflow-auto">
            <table className="min-w-full text-[11px] leading-tight">
              <thead className="sticky top-0 bg-slate-700 text-white">
                <tr>
                  <th className="px-2 py-1 text-left">CLIENTE</th>
                  <th className="px-2 py-1 text-left">HACIENDA-SITIO</th>
                  <th className="px-2 py-1 text-left">Area</th>
                  <th className="px-2 py-1 text-right">Total Hours Offline</th>
                  <th className="px-2 py-1 text-right">TIMES OFFLINE</th>
                </tr>
              </thead>
              <tbody>
                {resumenTopAreas.map((row, index) => (
                  <tr key={`${row.area}-${index}`} className="border-b border-gray-100">
                    <td className="px-2 py-1">{row.cliente}</td>
                    <td className="px-2 py-1">{row.hacienda}</td>
                    <td className="px-2 py-1">{row.area}</td>
                    <td className="px-2 py-1 text-right">{numberFormatter.format(row.offline)}</td>
                    <td className="px-2 py-1 text-right">{intFormatter.format(row.times)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Tabla principal</h3>
        <div className="h-[340px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-slate-700 text-white">
              <tr>
                {['CLIENTE', 'HACIENDA-SITIO', 'Area', 'Name', 'Total Hours Offline', 'TIMES OFFLINE'].map((header) => (
                  <th key={header} className="px-2 py-1 text-left">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalleTop100.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-b border-gray-100">
                  <td className="px-2 py-1">{row.cliente}</td>
                  <td className="px-2 py-1">{row.hacienda_sitio}</td>
                  <td className="px-2 py-1">{row.area}</td>
                  <td className="px-2 py-1">{row.name}</td>
                  <td className="px-2 py-1 text-right">{numberFormatter.format(Number(row.total_hours_offline || 0))}</td>
                  <td className="px-2 py-1 text-right">{intFormatter.format(Number(row.times_offline || 0))}</td>
                </tr>
              ))}
              {detalleTop100.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-center text-gray-500" colSpan={6}>
                    Sin datos para el rango seleccionado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-4 text-xs font-semibold text-gray-700">
          <span>Total Hours Offline: {numberFormatter.format(totalesDetalle.totalHoursOffline)}</span>
          <span>TIMES OFFLINE: {intFormatter.format(totalesDetalle.totalTimesOffline)}</span>
        </div>
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">% Up Time</h3>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartUptimeDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `${numberFormatter.format(Number(value))}%`} />
              <Line type="monotone" dataKey="uptime" stroke="#1C2E4A" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">% Up Time por Area / Cámara (Top 30 menor uptime)</h3>
        <div className="h-[300px] overflow-x-auto">
          <div style={{ minWidth: `${Math.max(800, rankingUptimeArea.length * 48)}px` }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingUptimeArea}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="area" interval={0} angle={-35} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `${numberFormatter.format(Number(value))}%`} />
                <Bar dataKey="uptime" fill="#334155" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Reincidencia en los últimos 7 días (&gt;2)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartReincidencia} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="camera" tick={{ fontSize: 10 }} width={190} />
                <Tooltip formatter={(value) => intFormatter.format(Number(value))} />
                <Bar dataKey="times" fill="#1C2E4A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Reincidencias entre ayer y hoy</h3>
          <div className="flex h-[300px] items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
            No disponible con la información actual.
          </div>
        </article>
      </section>

      {showInfoModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#1C2E4A]">Extracción de información - Operatividad CCTV</h2>
                <p className="text-sm text-gray-600">Trazabilidad del dato desde HikCentral hasta el dashboard.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-md border border-gray-300 p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="max-h-[85vh] overflow-hidden">
              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4 text-[#1C2E4A]" />
                    <h3 className="text-sm font-bold text-[#1C2E4A]">Resumen ejecutivo</h3>
                    <span className="rounded-full bg-[#1C2E4A]/10 px-3 py-1 text-xs font-semibold text-[#1C2E4A]">
                      Visión general
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Este dashboard se alimenta con información descargada automáticamente desde HikCentral Professional. Un RPA
                    desarrollado en Python/Selenium ingresa al portal, descarga el reporte de Resource Status / Camera, procesa
                    el archivo Excel generado por HikCentral y guarda la información en PostgreSQL. Luego, el backend
                    Node/Express consulta esa información para calcular horas online, horas offline, porcentaje de uptime y
                    reincidencias.
                  </p>
                </section>

                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-[#1C2E4A]" />
                    <h3 className="text-sm font-bold text-[#1C2E4A]">Flujo visual de extracción</h3>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {[
                      'HikCentral Professional',
                      'RPA Python/Selenium',
                      'Resource Status / Camera',
                      'Excel Camera',
                      'PostgreSQL',
                      'API Node/Express',
                      'Dashboard React',
                    ].map((step, index, arr) => (
                      <React.Fragment key={step}>
                        <span className="rounded-full bg-[#1C2E4A]/10 px-3 py-1 text-[#1C2E4A]">{step}</span>
                        {index < arr.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-gray-400" /> : null}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-[#1C2E4A]">HikCentral Professional:</span> Sistema fuente donde se
                      consulta el estado de cámaras.
                    </p>
                    <p>
                      <span className="font-semibold text-[#1C2E4A]">RPA Python/Selenium:</span> Automatiza el ingreso,
                      navegación y descarga del reporte.
                    </p>
                    <p>
                      <span className="font-semibold text-[#1C2E4A]">Resource Status / Camera:</span> Opción del portal donde
                      se obtiene el estado online/offline de cámaras.
                    </p>
                    <p>
                      <span className="font-semibold text-[#1C2E4A]">Excel Camera:</span> Archivo descargado con la hoja
                      Camera.
                    </p>
                    <p>
                      <span className="font-semibold text-[#1C2E4A]">PostgreSQL:</span> Base donde se almacena el estado actual
                      y el histórico.
                    </p>
                    <p>
                      <span className="font-semibold text-[#1C2E4A]">API Node/Express:</span> Servicios que calculan y entregan
                      los indicadores al frontend.
                    </p>
                    <p className="md:col-span-2">
                      <span className="font-semibold text-[#1C2E4A]">Dashboard React:</span> Pantalla donde el usuario visualiza
                      filtros, gráficos, tablas y exportación.
                    </p>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-[#1C2E4A]" />
                    <h3 className="text-sm font-bold text-[#1C2E4A]">Archivo origen descargado</h3>
                  </div>
                  <p className="mb-3 text-sm text-gray-600">
                    El RPA descarga un archivo Excel generado por HikCentral para la opción Camera. El archivo contiene una hoja
                    llamada Camera. La información útil inicia después del encabezado del reporte y se procesa tomando las
                    columnas operativas de estado de cámaras.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Elemento</th>
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {[
                          ['Fuente', 'HikCentral Professional'],
                          ['Ruta funcional', 'Maintenance → Resource Status → Camera'],
                          ['Formato', 'Excel'],
                          ['Hoja procesada', 'Camera'],
                          ['Frecuencia', 'Según programación del RPA'],
                          ['Uso principal', 'Estado online/offline, señal, grabación y fecha de revisión'],
                        ].map(([elemento, descripcion]) => (
                          <tr key={elemento}>
                            <td className="border-b border-gray-200 px-3 py-2 font-semibold text-[#1C2E4A]">{elemento}</td>
                            <td className="border-b border-gray-200 px-3 py-2">{descripcion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-bold text-[#1C2E4A]">Campos principales utilizados</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Campo HikCentral</th>
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Uso en el dashboard</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {[
                          ['Name', 'Nombre de la cámara'],
                          ['Channel Address', 'Código o identificador del canal/dispositivo'],
                          ['Device Address', 'Dirección IP o dirección del dispositivo'],
                          ['Area', 'Estructura usada para derivar Cliente y Hacienda-Sitio'],
                          ['Device Model', 'Tipo/modelo del dispositivo'],
                          ['Network Status', 'Estado Online / Offline'],
                          ['Recording Status', 'Estado de grabación'],
                          ['Video Signal', 'Estado de señal de video'],
                          ['Auto-Check Time', 'Fecha/hora del snapshot usado para análisis histórico'],
                        ].map(([campo, uso]) => (
                          <tr key={campo}>
                            <td className="border-b border-gray-200 px-3 py-2 font-semibold text-[#1C2E4A]">{campo}</td>
                            <td className="border-b border-gray-200 px-3 py-2">{uso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4 text-[#1C2E4A]" />
                    <h3 className="text-sm font-bold text-[#1C2E4A]">Tablas utilizadas</h3>
                  </div>
                  <p className="mb-3 text-sm text-gray-600">
                    La carga del RPA mantiene una tabla de estado actual y una tabla histórica. La tabla histórica es la base
                    para calcular disponibilidad por rango de fechas.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Tabla</th>
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Uso</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        <tr>
                          <td className="border-b border-gray-200 px-3 py-2 font-semibold text-[#1C2E4A]">
                            PUBLIC.HIK_CAMERA_RESOURCE_STATUS
                          </td>
                          <td className="border-b border-gray-200 px-3 py-2">
                            Guarda el estado actual más reciente de cada cámara.
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-gray-200 px-3 py-2 font-semibold text-[#1C2E4A]">
                            PUBLIC.HIK_CAMERA_RESOURCE_STATUS_HIST
                          </td>
                          <td className="border-b border-gray-200 px-3 py-2">
                            Guarda snapshots históricos para calcular horas online, horas offline, uptime y reincidencias.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    La tabla de estado actual permite ver la última condición conocida de la cámara. La tabla histórica permite
                    reconstruir el comportamiento en el tiempo.
                  </p>
                </section>

                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Server className="h-4 w-4 text-[#1C2E4A]" />
                    <h3 className="text-sm font-bold text-[#1C2E4A]">Cómo se calculan los indicadores</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>
                      <span className="font-semibold text-[#1C2E4A]">Total cámaras:</span> Cantidad de cámaras distintas dentro
                      del rango y filtros aplicados.
                    </li>
                    <li>
                      <span className="font-semibold text-[#1C2E4A]">Total Hours Offline:</span> Suma de intervalos en los que
                      una cámara permaneció con Network Status = Offline.
                    </li>
                    <li>
                      <span className="font-semibold text-[#1C2E4A]">Total Hours Online:</span> Tiempo disponible menos Total
                      Hours Offline.
                    </li>
                    <li>
                      <span className="font-semibold text-[#1C2E4A]">% Up Time:</span> Porcentaje de disponibilidad calculado a
                      partir del tiempo online sobre el tiempo total disponible.
                    </li>
                    <li>
                      <span className="font-semibold text-[#1C2E4A]">TIMES OFFLINE:</span> Cantidad de registros o eventos donde
                      la cámara aparece en estado Offline.
                    </li>
                    <li>
                      <span className="font-semibold text-[#1C2E4A]">Reincidencia:</span> Cámaras o áreas que presentan
                      múltiples eventos offline dentro de un periodo, por ejemplo últimos 7 días.
                    </li>
                  </ul>
                  <div className="mt-3 rounded-lg border border-[#1C2E4A]/20 bg-white p-3 text-xs text-gray-700">
                    <p className="font-semibold text-[#1C2E4A]">Fórmulas de referencia:</p>
                    <p>Tiempo disponible = N° cámaras × horas del rango</p>
                    <p>Total Hours Online = Tiempo disponible - Total Hours Offline</p>
                    <p>% Up Time = (Total Hours Online / Tiempo disponible) × 100</p>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-bold text-[#1C2E4A]">Datos derivados desde Area</h3>
                  <p className="text-sm text-gray-600">
                    HikCentral no siempre entrega Cliente y Hacienda-Sitio como columnas separadas. Cuando no existen
                    explícitamente, el sistema los deriva desde el campo Area.
                  </p>
                  <div className="mt-3 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm md:grid-cols-2">
                    <div>
                      <p className="font-semibold text-[#1C2E4A]">Ejemplo de origen</p>
                      <p className="text-gray-700">Area = [RBP]-ZUL1-B.CTRA</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#1C2E4A]">Resultado derivado</p>
                      <p className="text-gray-700">Cliente: RBP</p>
                      <p className="text-gray-700">Hacienda-Sitio: ZUL1-B.CTRA</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Si el campo Area no cumple el patrón esperado, el registro puede clasificarse como SIN CLIENTE o mantener el
                    valor original como referencia.
                  </p>
                </section>

                <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <h3 className="text-sm font-bold text-amber-800">Consideraciones importantes</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-amber-900">
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>El dashboard depende de la correcta ejecución del RPA.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Si el RPA no descarga información nueva, los indicadores pueden quedar desactualizados.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Los cálculos históricos requieren que existan snapshots en la tabla histórica.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Si una cámara no tiene registros suficientes en el rango, el cálculo puede depender del último estado
                        conocido.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Cliente y Hacienda-Sitio pueden ser derivados desde Area cuando HikCentral no los entrega por separado.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>La precisión del uptime depende de la frecuencia con la que se ejecuta el RPA.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Los registros Offline sin un siguiente cambio de estado pueden cerrarse contra la fecha final del filtro
                        o la hora actual, según la lógica del backend.
                      </span>
                    </li>
                  </ul>
                </section>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock3 className="h-3.5 w-3.5" />
                <span>Última actualización visible según los datos cargados por el RPA.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1C2E4A] px-4 text-sm font-semibold text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IndicadoresOperatividadCCTV;
