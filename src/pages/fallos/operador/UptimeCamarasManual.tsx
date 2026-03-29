import React, { useEffect, useMemo, useState } from 'react';
import { DashboardUptimeFilters, DashboardUptimeResponse, UptimeDetalleRow } from '@/services/dashboardUptimeCamarasService';
import { getClientesActivos, type ClienteResumen } from '@/services/clientes.service';
import { fetchDashboardUptimeCamarasManual } from '@/services/dashboardUptimeCamarasManualService';
import { getHaciendasActivas, type HaciendaResumen } from '@/services/haciendas.service';
import * as XLSX from 'xlsx';

const numberFormatter = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const formatNumber = (value: number) => numberFormatter.format(value || 0);

const formatDateValue = (value?: string | null) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatDateTimeValue = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const formatTimestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}`;
};

const normalizeTime = (value?: string | null) => {
  if (!value) return '';
  return value.length >= 8 ? value.slice(0, 8) : value;
};

const getHoraFallo = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString();
};

const getDuracionHoras = (row: UptimeDetalleRow) => {
  const inicio = new Date(row.fecha_fallo);
  if (Number.isNaN(inicio.getTime())) return '0.00';

  const fin = row.fecha_resolucion
    ? new Date(`${row.fecha_resolucion} ${row.hora_resolucion ?? '00:00:00'}`)
    : new Date();

  if (Number.isNaN(fin.getTime())) return '0.00';

  const duracionHoras = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  if (!Number.isFinite(duracionHoras) || duracionHoras < 0) return '0.00';

  return duracionHoras.toFixed(2);
};

type SortKey =
  | 'mes'
  | 'tipo_afectacion'
  | 'sitio'
  | 'fecha_fallo'
  | 'hora_fallo'
  | 'fecha_resolucion'
  | 'hora_resolucion'
  | 'duracion_total_fallo_h';

type SortDirection = 'asc' | 'desc';

const UptimeCamarasManual: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return formatDateInput(start);
  }, []);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(formatDateInput(today));
  const [selectedHacienda, setSelectedHacienda] = useState<string>('');
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [reportadoCliente, setReportadoCliente] = useState(false);
  const [haciendas, setHaciendas] = useState<HaciendaResumen[]>([]);
  const [clientes, setClientes] = useState<ClienteResumen[]>([]);

  const [kpis, setKpis] = useState<DashboardUptimeResponse['kpis']>({ dias: 0, camaras: 0, t_disponible_h: 0, t_caido_h: 0, uptime_pct: 0 });

  const [allRows, setAllRows] = useState<UptimeDetalleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'fecha_fallo',
    direction: 'desc',
  });

  useEffect(() => {
    getHaciendasActivas().then((data) => setHaciendas(data)).catch(() => setHaciendas([]));
  }, []);

  useEffect(() => {
    getClientesActivos().then((data) => setClientes(data)).catch(() => setClientes([]));
  }, []);

  const loadData = async (filters: DashboardUptimeFilters) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardUptimeCamarasManual(filters);
      setKpis(data.kpis);
      setAllRows(data.detalle ?? []);
    } catch (err) {
      console.error('[UptimeCamarasManual] Error al cargar datos', err);
      const message = err instanceof Error && err.message ? err.message : 'No se pudo cargar la información de uptime de cámaras (manual)';
      setError(message);
      setKpis({ dias: 0, camaras: 0, t_disponible_h: 0, t_caido_h: 0, uptime_pct: 0 });
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({
      from: fromDate,
      to: toDate,
      haciendaId: selectedHacienda ? Number(selectedHacienda) : null,
      clienteId: selectedCliente ? Number(selectedCliente) : null,
      reportadoCliente: reportadoCliente ? true : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    loadData({
      from: fromDate,
      to: toDate,
      haciendaId: selectedHacienda ? Number(selectedHacienda) : null,
      clienteId: selectedCliente ? Number(selectedCliente) : null,
      reportadoCliente: reportadoCliente ? true : null,
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return '▼▲';
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig) return allRows;
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    const compareValues = (aValue: number | string | null, bValue: number | string | null) => {
      const aMissing = aValue === null || aValue === undefined || aValue === '';
      const bMissing = bValue === null || bValue === undefined || bValue === '';
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (aValue === bValue) return 0;
        return aValue > bValue ? direction : -direction;
      }

      return String(aValue).localeCompare(String(bValue), 'es') * direction;
    };

    return [...allRows].sort((a, b) => {
      switch (sortConfig.key) {
        case 'fecha_fallo':
          return compareValues(new Date(a.fecha_fallo).getTime(), new Date(b.fecha_fallo).getTime());
        case 'hora_fallo':
          return compareValues(getHoraFallo(a.fecha_fallo), getHoraFallo(b.fecha_fallo));
        case 'fecha_resolucion':
          return compareValues(
            a.fecha_resolucion ? new Date(a.fecha_resolucion).getTime() : null,
            b.fecha_resolucion ? new Date(b.fecha_resolucion).getTime() : null,
          );
        case 'hora_resolucion':
          return compareValues(normalizeTime(a.hora_resolucion), normalizeTime(b.hora_resolucion));
        case 'duracion_total_fallo_h':
          return compareValues(Number(getDuracionHoras(a)), Number(getDuracionHoras(b)));
        default:
          return compareValues(
            String((a as Record<string, unknown>)[sortConfig.key] ?? '').toLowerCase(),
            String((b as Record<string, unknown>)[sortConfig.key] ?? '').toLowerCase(),
          );
      }
    });
  }, [allRows, sortConfig]);

  const uptimeDisponible = formatNumber(kpis.t_disponible_h);
  const uptimeCaido = formatNumber(kpis.t_caido_h);

  const handleExport = () => {
    const rowsToExport = sortedRows.map((row) => ({
      Mes: row.mes,
      'TIPO DE AFECTACION': row.tipo_afectacion,
      SITIO: row.sitio,
      'FECHA DE FALLO': formatDateTimeValue(row.fecha_fallo),
      'HORA DE FALLO': getHoraFallo(row.fecha_fallo),
      'FECHA DE SOLUCION': formatDateValue(row.fecha_resolucion),
      'HORA DE SOLUCION': normalizeTime(row.hora_resolucion),
      'DURACION TOTAL DEL FALLO (H)': `${getDuracionHoras(row)} h`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Uptime');
    const filename = `uptime_camaras_manual_${formatTimestamp()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const columns: Array<{ key: SortKey; header: string; size: number }> = [
    { key: 'mes', header: 'Mes', size: 120 },
    { key: 'tipo_afectacion', header: 'TIPO DE AFECTACION', size: 120 },
    { key: 'sitio', header: 'SITIO', size: 120 },
    { key: 'fecha_fallo', header: 'FECHA DE FALLO', size: 120 },
    { key: 'hora_fallo', header: 'HORA DE FALLO', size: 120 },
    { key: 'fecha_resolucion', header: 'FECHA DE SOLUCION', size: 120 },
    { key: 'hora_resolucion', header: 'HORA DE SOLUCION', size: 120 },
    { key: 'duracion_total_fallo_h', header: 'DURACION TOTAL DEL FALLO (H)', size: 120 },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Uptime Cámaras (Registro Manual)</h1>
          <p className="text-sm text-gray-600">Disponibilidad de cámaras basada en eventos offline registrados.</p>
        </div>
      </header>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <form className="grid grid-cols-1 md:grid-cols-6 gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Fecha Desde
            <input type="date" required value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]" />
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Fecha Hasta
            <input type="date" required value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]" />
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Hacienda (opcional)
            <select value={selectedHacienda} onChange={(e) => setSelectedHacienda(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]">
              <option value="">Todas</option>
              {haciendas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Cliente
            <select value={selectedCliente} onChange={(e) => setSelectedCliente(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]">
              <option value="">Todos</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mt-6 md:mt-0">
            <input type="checkbox" checked={reportadoCliente} onChange={(e) => setReportadoCliente(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]" />
            Reportado al cliente
          </label>
          <div className="flex items-end md:col-span-1">
            <button type="submit" className="w-full rounded-md bg-[#1C2E4A] px-4 py-2 text-white font-semibold hover:bg-[#243b55] transition-colors" disabled={loading}>
              {loading ? 'Cargando...' : 'Aplicar filtros'}
            </button>
          </div>
        </form>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">N° días</p><p className="text-2xl font-bold text-[#1C2E4A]">{formatNumber(kpis.dias)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">N° cámaras</p><p className="text-2xl font-bold text-[#1C2E4A]">{formatNumber(kpis.camaras)}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">T. disponible (horas)</p><p className="text-2xl font-bold text-[#1C2E4A]">{uptimeDisponible}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">T. caído (horas)</p><p className="text-2xl font-bold text-[#1C2E4A]">{uptimeCaido}</p></div>
        <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">% Uptime</p><p className="text-2xl font-bold text-[#1C2E4A]">{formatNumber(kpis.uptime_pct)}%</p></div>
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-[#1C2E4A]">Detalle de caídas</h2>
          <button type="button" onClick={handleExport} className="inline-flex items-center justify-center rounded-md bg-[#1C2E4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243b55] transition-colors">Exportar a Excel</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      style={{ minWidth: `${column.size}px` }}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 cursor-pointer"
                      onClick={() => handleSort(column.key)}
                    >
                      <span className="flex items-center gap-1">{column.header}<span className="text-[10px] text-gray-400">{renderSortIcon(column.key)}</span></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                      {loading ? 'Cargando datos...' : 'No hay registros para mostrar'}
                    </td>
                  </tr>
                )}
                {sortedRows.map((row, index) => (
                  <tr key={`${row.id ?? row.fecha_fallo}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700">{row.mes}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.tipo_afectacion ?? ''}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.sitio ?? ''}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatDateTimeValue(row.fecha_fallo)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{getHoraFallo(row.fecha_fallo)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatDateValue(row.fecha_resolucion)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{normalizeTime(row.hora_resolucion)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{getDuracionHoras(row)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UptimeCamarasManual;
