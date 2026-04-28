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

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <article className="rounded-lg bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Distribución por Hacienda-Sitio</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} innerRadius={55} outerRadius={95} dataKey="value" nameKey="name" labelLine={false}>
                  {donutData.map((entry, index) => (
                    <Cell key={entry.name} fill={donutColors[index % donutColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => intFormatter.format(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-lg bg-white p-3 shadow-sm xl:col-span-2">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[#1C2E4A]">Top Áreas/Cámaras por Offline</h3>
          <div className="h-[260px] overflow-auto">
            <table className="min-w-full text-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-lg font-bold text-[#1C2E4A]">Extracción de información - Operatividad CCTV</h2>
            <p className="mb-3 text-sm text-gray-700">
              La información de este dashboard se obtiene desde HikCentral Professional mediante un proceso RPA desarrollado en
              Python/Selenium.
            </p>
            <p className="mb-2 text-sm font-semibold text-gray-800">Flujo de extracción:</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
              <li>El RPA ingresa al portal HikCentral Professional.</li>
              <li>Navega a la opción Maintenance.</li>
              <li>Ingresa a Resource Status.</li>
              <li>Selecciona la opción Camera.</li>
              <li>Descarga el archivo Excel generado por HikCentral.</li>
              <li>El archivo contiene una hoja llamada Camera.</li>
              <li>
                El proceso lee la hoja Camera y toma campos como: Name, Channel Address, Device Address, Area, Device Model,
                Network Status, Recording Status, Video Signal y Auto-Check Time.
              </li>
              <li>La información se guarda en PostgreSQL.</li>
              <li>La tabla de estado actual es: PUBLIC.HIK_CAMERA_RESOURCE_STATUS.</li>
              <li>La tabla histórica usada para calcular uptime es: PUBLIC.HIK_CAMERA_RESOURCE_STATUS_HIST.</li>
              <li>
                El dashboard consume endpoints Node/Express para calcular Total Hours Offline, Total Hours Online, % Up Time,
                TIMES OFFLINE y Reincidencias.
              </li>
            </ol>
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-gray-700">
              Nota: Cliente y Hacienda-Sitio no siempre vienen como campos separados desde HikCentral. Cuando no existen
              explícitamente, el sistema los deriva desde el campo Area. Si el formato del Area no permite identificar el
              cliente, se clasifica como SIN CLIENTE.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="h-9 rounded-md bg-[#1C2E4A] px-4 text-sm font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IndicadoresOperatividadCCTV;
