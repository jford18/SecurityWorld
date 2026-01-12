import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getConsolas } from '@/services/consolasService';
import {
  LogeoTurnoFilters,
  LogeoTurnoRow,
  exportReporteLogeosTurnosExcel,
  getReporteLogeosTurnos,
} from '@/services/reporteLogeosTurnosService';

const pageSizeOptions = [5, 10, 20, 50];

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatTime = (value: string) => {
  const date = new Date(`1970-01-01T${value}`);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return value;
};

const toast = {
  error: (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.error(message);
  },
};

const ReporteLogeosTurnos: React.FC = () => {
  const [filters, setFilters] = useState<LogeoTurnoFilters>({ fecha_desde: '', fecha_hasta: '' });
  const [data, setData] = useState<LogeoTurnoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consolas, setConsolas] = useState<Array<{ id: number; nombre: string }>>([]);

  const totalPages = useMemo(() => (rowsPerPage > 0 ? Math.ceil(total / rowsPerPage) : 0), [rowsPerPage, total]);

  useEffect(() => {
    const fetchConsolas = async () => {
      try {
        const lista = await getConsolas();
        setConsolas(lista);
      } catch (err) {
        console.error('No se pudieron cargar las consolas', err);
        setConsolas([]);
      }
    };

    fetchConsolas();
  }, []);

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  const fetchData = useCallback(async () => {
    if (!filters.fecha_desde || !filters.fecha_hasta) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await getReporteLogeosTurnos({
        ...filters,
        page,
        limit: rowsPerPage,
      });

      setData(response.data ?? []);
      setTotal(Number(response.total ?? 0));
    } catch (err) {
      console.error('No se pudo cargar el reporte de logeos por turno', err);
      setError('No se pudo cargar el reporte.');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, rowsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (key: keyof LogeoTurnoFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleExport = async () => {
    if (!filters.fecha_desde || !filters.fecha_hasta) {
      const message = 'Seleccione el rango de fechas para exportar.';
      setError(message);
      toast.error(message);
      return;
    }

    if (loading || isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      setError(null);

      const { blob, filename } = await exportReporteLogeosTurnosExcel(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error('No se pudo exportar el reporte de logeos por turno', exportError);
      const message =
        exportError instanceof Error && exportError.message
          ? exportError.message
          : 'No se pudo exportar el reporte.';
      setError(message);
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#1C2E4A]">Logeos por Turno</h1>
        <p className="text-sm text-gray-600">Consulta los accesos por fecha, turno, consola y usuario.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="fechaDesde">
            Fecha Desde
          </label>
          <input
            id="fechaDesde"
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            value={filters.fecha_desde}
            onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="fechaHasta">
            Fecha Hasta
          </label>
          <input
            id="fechaHasta"
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            value={filters.fecha_hasta}
            onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="turno">
            Turno
          </label>
          <select
            id="turno"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            value={filters.turno ?? ''}
            onChange={(e) => handleFilterChange('turno', e.target.value as LogeoTurnoFilters['turno'])}
          >
            <option value="">Todos</option>
            <option value="DIURNO">Diurno</option>
            <option value="NOCTURNO">Nocturno</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="consola">
            Consola
          </label>
          <select
            id="consola"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            value={filters.consola_id ?? ''}
            onChange={(e) => handleFilterChange('consola_id', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todas</option>
            {consolas.map((consola) => (
              <option key={consola.id} value={consola.id}>
                {consola.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="usuario">
            Usuario
          </label>
          <input
            id="usuario"
            type="text"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            placeholder="Nombre de usuario"
            value={filters.usuario ?? ''}
            onChange={(e) => handleFilterChange('usuario', e.target.value)}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          onClick={() => {
            if (!filters.fecha_desde || !filters.fecha_hasta) {
              setError('Seleccione el rango de fechas');
              return;
            }
            fetchData();
          }}
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Buscar'}
        </button>
        <button
          type="button"
          className="rounded-md border border-yellow-400 px-4 py-2 text-sm font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleExport}
          disabled={loading || isExporting}
        >
          {isExporting ? 'Exportando...' : 'Exportar a Excel'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Fecha</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Hora</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Turno</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Usuario</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Nombre completo
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Consola</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-center text-sm text-gray-500" colSpan={6}>
                  {loading ? 'Cargando...' : 'Sin resultados para los filtros seleccionados'}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id_log} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{formatDate(row.fecha_logeo)}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{formatTime(row.hora_logeo)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.turno}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{row.usuario ?? 'Sin usuario'}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {row.nombre_completo ?? 'Sin nombre completo'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">{row.consola ?? 'SIN CONSOLA'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>Filas por página:</span>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            value={rowsPerPage}
            onChange={(e) => {
              const value = Number(e.target.value);
              setRowsPerPage(Number.isFinite(value) && value > 0 ? value : rowsPerPage);
              setPage(0);
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span>
            Mostrando {data.length} de {total} registros
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={page === 0}
          >
            Anterior
          </button>
          <span>
            Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
          </span>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
            disabled={page + 1 >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReporteLogeosTurnos;
