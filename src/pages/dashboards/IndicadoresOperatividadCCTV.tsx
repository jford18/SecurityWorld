import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

const toLabelDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
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

  const chartUptimeCliente = uptimeCliente.map((item) => ({
    cliente: item.cliente,
    uptime: Number(item.uptime_pct || 0),
    offline: Number(item.total_hours_offline || 0),
    online: Number(item.total_hours_online || 0),
  }));

  const chartUptimeDia = uptimeDia.map((item) => ({
    dia: toLabelDate(item.day),
    uptime: Number(item.uptime_pct || 0),
  }));

  const chartReincidencia = reincidencia.map((item) => ({
    camera: item.name,
    times: Number(item.times_offline_7d || 0),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#1C2E4A]">Indicadores de Operatividad CCTV</h1>
        <p className="text-sm text-gray-600">Departamento Técnico</p>
      </header>

      <section className="rounded-lg bg-white p-6 shadow">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={onApplyFilters}>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Fecha Desde
            <input
              type="date"
              required
              value={filters.fechaDesde}
              onChange={(event) => setFilters((prev) => ({ ...prev, fechaDesde: event.target.value }))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Fecha Hasta
            <input
              type="date"
              required
              value={filters.fechaHasta}
              onChange={(event) => setFilters((prev) => ({ ...prev, fechaHasta: event.target.value }))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Cliente
            <select
              value={filters.cliente}
              onChange={(event) => setFilters((prev) => ({ ...prev, cliente: event.target.value }))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Todos</option>
              {filtrosCatalogo.cliente.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Hacienda-Sitio
            <select
              value={filters.haciendaSitio}
              onChange={(event) => setFilters((prev) => ({ ...prev, haciendaSitio: event.target.value }))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Todos</option>
              {filtrosCatalogo.haciendaSitio.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Area
            <select
              value={filters.area}
              onChange={(event) => setFilters((prev) => ({ ...prev, area: event.target.value }))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Todas</option>
              {filtrosCatalogo.area.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Cámara / Name
            <select
              value={filters.name}
              onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Todas</option>
              {filtrosCatalogo.cameraName.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-md bg-[#1C2E4A] px-4 py-2 font-semibold text-white">
              {loading ? 'Cargando...' : 'Aplicar filtros'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onExportExcel}
              className="w-full rounded-md border border-[#1C2E4A] px-4 py-2 font-semibold text-[#1C2E4A]"
            >
              Exportar a Excel
            </button>
          </div>
        </form>
        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">Total cámaras</p><p className="text-xl font-bold">{numberFormatter.format(resumen.total_camaras || 0)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">Cámaras Online</p><p className="text-xl font-bold">{numberFormatter.format(resumen.camaras_online || 0)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">Cámaras Offline</p><p className="text-xl font-bold">{numberFormatter.format(resumen.camaras_offline || 0)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">Total Hours Online</p><p className="text-xl font-bold">{numberFormatter.format(resumen.total_hours_online || 0)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">Total Hours Offline</p><p className="text-xl font-bold">{numberFormatter.format(resumen.total_hours_offline || 0)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">% Up Time</p><p className="text-xl font-bold">{numberFormatter.format(resumen.uptime_pct || 0)}%</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-xs text-gray-500">Times Offline</p><p className="text-xl font-bold">{numberFormatter.format(resumen.times_offline || 0)}</p></div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-2 text-sm font-semibold text-[#1C2E4A]">% Up Time por Cliente</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartUptimeCliente}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cliente" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="uptime" fill="#1C2E4A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-2 text-sm font-semibold text-[#1C2E4A]">Total Hours Offline vs Total Hours Online por Cliente</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartUptimeCliente} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="cliente" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="offline" fill="#dc2626" name="Offline" />
                <Bar dataKey="online" fill="#16a34a" name="Online" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-2 text-sm font-semibold text-[#1C2E4A]">% Up Time por día</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartUptimeDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="uptime" stroke="#1C2E4A" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-2 text-sm font-semibold text-[#1C2E4A]">Reincidencia últimos 7 días</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartReincidencia} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="camera" width={180} />
                <Tooltip />
                <Bar dataKey="times" fill="#f59e0b" name="Times Offline" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold text-[#1C2E4A]">Detalle principal</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['CLIENTE', 'HACIENDA-SITIO', 'AREA', 'NAME', 'NETWORK STATUS', 'AUTO CHECK TIME', 'TOTAL HOURS OFFLINE', 'TOTAL HOURS ONLINE', 'TIMES OFFLINE', '% UP TIME'].map((header) => (
                  <th key={header} className="px-3 py-2 text-left font-semibold text-gray-700">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {detalle.map((row, index) => (
                <tr key={`${row.name}-${row.area}-${index}`}>
                  <td className="px-3 py-2">{row.cliente}</td>
                  <td className="px-3 py-2">{row.hacienda_sitio}</td>
                  <td className="px-3 py-2">{row.area}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.network_status}</td>
                  <td className="px-3 py-2">{toLabelDate(row.auto_check_time)}</td>
                  <td className="px-3 py-2">{numberFormatter.format(row.total_hours_offline || 0)}</td>
                  <td className="px-3 py-2">{numberFormatter.format(row.total_hours_online || 0)}</td>
                  <td className="px-3 py-2">{numberFormatter.format(row.times_offline || 0)}</td>
                  <td className="px-3 py-2">{numberFormatter.format(row.uptime_pct || 0)}%</td>
                </tr>
              ))}
              {detalle.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-center text-gray-500" colSpan={10}>
                    Sin datos para el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default IndicadoresOperatividadCCTV;
