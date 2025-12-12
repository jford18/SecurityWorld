import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getAll as getNodos } from '../../services/nodos.service';
import {
  assign as assignNodoSitio,
  getAllForExport as getAllAsignacionesForExport,
  getByNodo as getSitiosAsignados,
} from '../../services/nodosSitios.service';

const toast = {
  success: (message) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.log(message);
  },
  error: (message) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.error(message);
  },
};

const resolveErrorMessage = (error, fallback) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
};

const primaryButtonClasses =
  'inline-flex justify-center rounded-md bg-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed';
const secondaryButtonClasses =
  'inline-flex justify-center rounded-md border border-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed';

const AsignacionNodosSitios = () => {
  const [nodos, setNodos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [selectedNodoId, setSelectedNodoId] = useState(null);
  const [selectedSitios, setSelectedSitios] = useState(new Set());
  const [initialSitios, setInitialSitios] = useState(new Set());
  const [loadingNodos, setLoadingNodos] = useState(false);
  const [loadingSitios, setLoadingSitios] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadNodos = useCallback(async () => {
    try {
      setLoadingNodos(true);
      const response = await getNodos();
      const lista = Array.isArray(response)
        ? response
        : response?.data;

      if (!Array.isArray(lista)) {
        throw new Error('Respuesta inválida al cargar nodos');
      }

      const nodosOrdenados = [...lista].sort((a, b) => {
        const nombreA = (a.nombre ?? '').toLowerCase();
        const nombreB = (b.nombre ?? '').toLowerCase();
        return nombreA.localeCompare(nombreB);
      });

      setNodos(nodosOrdenados);
      setErrorMessage('');

      setSelectedNodoId((prev) => {
        if (prev && nodosOrdenados.some((nodo) => nodo.id === prev)) {
          return prev;
        }
        return nodosOrdenados.length > 0 ? nodosOrdenados[0].id : null;
      });
    } catch (error) {
      console.error('Error al cargar nodos:', error);
      const message = resolveErrorMessage(error, 'No se pudieron cargar los nodos');
      setErrorMessage(message);
      toast.error(message);
      setNodos([]);
      setSelectedNodoId(null);
    } finally {
      setLoadingNodos(false);
    }
  }, []);

  const loadSitiosPorNodo = useCallback(
    async (nodoId) => {
      if (!nodoId) {
        const vacio = new Set();
        setSitios([]);
        setSelectedSitios(vacio);
        setInitialSitios(new Set(vacio));
        return;
      }

      try {
        setLoadingSitios(true);
        const response = await getSitiosAsignados(nodoId);
        const payload = response?.sitios ?? response?.data ?? response;

        if (!Array.isArray(payload)) {
          throw new Error('Respuesta inválida al cargar los sitios del nodo');
        }

        const sitiosOrdenados = [...payload]
          .filter((sitio) => sitio.activo !== false)
          .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));

        const asignados = new Set(
          sitiosOrdenados
            .filter((item) => item.asignado === true)
            .map((item) => Number(item.id))
            .filter((id) => Number.isInteger(id))
        );

        setSitios(sitiosOrdenados);
        setSelectedSitios(asignados);
        setInitialSitios(new Set(asignados));
        setErrorMessage('');
      } catch (error) {
        console.error('Error al cargar sitios del nodo:', error);
        const message = resolveErrorMessage(
          error,
          'No se pudieron cargar los sitios del nodo'
        );
        setErrorMessage(message);
        toast.error(message);
        setSitios([]);
        setSelectedSitios(new Set());
        setInitialSitios(new Set());
      } finally {
        setLoadingSitios(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNodos();
  }, [loadNodos]);

  useEffect(() => {
    loadSitiosPorNodo(selectedNodoId);
  }, [selectedNodoId, loadSitiosPorNodo]);

  const handleSelectNodo = (event) => {
    const value = Number(event.target.value);
    setSelectedNodoId(Number.isFinite(value) ? value : null);
  };

  const handleToggleSitio = (sitioId, checked) => {
    setSitios((prev) =>
      prev.map((sitio) =>
        Number(sitio.id) === sitioId ? { ...sitio, asignado: checked } : sitio
      )
    );

    setSelectedSitios((prev) => {
      const updated = new Set(prev);
      if (checked) {
        updated.add(sitioId);
      } else {
        updated.delete(sitioId);
      }
      return updated;
    });
  };

  const cambiosPendientes = useMemo(() => {
    const current = selectedSitios;
    const initial = initialSitios;

    const asignaciones = [];
    current.forEach((id) => {
      if (!initial.has(id)) {
        asignaciones.push({ tipo: 'asignar', id });
      }
    });

    const eliminaciones = [];
    initial.forEach((id) => {
      if (!current.has(id)) {
        eliminaciones.push({ tipo: 'eliminar', id });
      }
    });

    return { asignaciones, eliminaciones };
  }, [selectedSitios, initialSitios]);

  const sitiosAsignados = useMemo(
    () => sitios.filter((sitio) => sitio.asignado).length,
    [sitios]
  );

  const handleGuardar = async () => {
    if (!selectedNodoId) {
      toast.error('Selecciona un nodo para guardar los cambios');
      return;
    }

    const { asignaciones, eliminaciones } = cambiosPendientes;

    if (asignaciones.length === 0 && eliminaciones.length === 0) {
      toast.success('No hay cambios por guardar');
      return;
    }

    const sitiosIds = Array.from(selectedSitios).filter((id) => Number.isInteger(id));

    try {
      setSaving(true);
      setErrorMessage('');

      await assignNodoSitio({
        nodoId: Number(selectedNodoId),
        sitiosIds,
      });

      toast.success('Cambios guardados correctamente');
      await loadSitiosPorNodo(selectedNodoId);
    } catch (error) {
      console.error('Error al guardar cambios de asignación:', error);
      const message = resolveErrorMessage(error, 'No se pudieron guardar los cambios');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefrescar = async () => {
    await loadNodos();
    await loadSitiosPorNodo(selectedNodoId);
  };

  const isLoading = loadingNodos || loadingSitios;

  const handleExportToExcel = async () => {
    if (isLoading) return;

    try {
      const allAsignaciones = await getAllAsignacionesForExport();

      if (!Array.isArray(allAsignaciones) || allAsignaciones.length === 0) {
        toast.error('No hay datos para exportar');
        return;
      }

      const formattedRows = allAsignaciones.map((item) => ({
        Seleccionar: item.asignado === false ? 'No' : 'Sí',
        Nodo: item.nodo_nombre ?? 'Sin nombre',
        Sitio: item.sitio_nombre ?? 'Sin nombre',
        Descripción: item.sitio_descripcion || 'Sin descripción',
        'Fecha asignación': item.fecha_asignacion
          ? new Date(item.fecha_asignacion).toLocaleString()
          : 'Sin fecha',
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Asignación');

      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate()
      ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
        now.getMinutes()
      ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      const filename = `asignacion_nodos_sitios_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error al exportar asignaciones nodo-sitio:', error);
      const message = resolveErrorMessage(
        error,
        'Error al exportar las asignaciones nodo-sitio a Excel'
      );
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Asignación Nodos–Sitios</h1>
          <p className="text-sm text-gray-500">
            Selecciona un nodo para asignar o quitar los sitios asociados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClasses}
            onClick={handleRefrescar}
            disabled={isLoading || saving}
          >
            Refrescar
          </button>
          <button
            type="button"
            className={primaryButtonClasses}
            onClick={handleGuardar}
            disabled={saving || isLoading}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="nodo-select" className="block text-sm font-medium text-gray-700">
              Nodo
            </label>
            <select
              id="nodo-select"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A] disabled:opacity-60"
              value={selectedNodoId ?? ''}
              onChange={handleSelectNodo}
              disabled={loadingNodos || nodos.length === 0}
            >
              {nodos.length === 0 ? (
                <option value="">No hay nodos disponibles</option>
              ) : (
                nodos.map((nodo) => (
                  <option key={nodo.id} value={nodo.id}>
                    {nodo.nombre}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              {selectedNodoId
                ? `Sitios asignados: ${sitiosAsignados}`
                : 'Selecciona un nodo para ver las asignaciones'}
            </p>
            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Cargando información...</p>
          ) : !selectedNodoId ? (
            <p className="text-sm text-gray-500">Selecciona un nodo para administrar sus sitios.</p>
          ) : sitios.length === 0 ? (
            <p className="text-sm text-gray-500">No hay sitios disponibles para asignar.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#1C2E4A]">Sitios del nodo</h3>
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-md ${
                    isLoading
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Exportar a Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#1C2E4A]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Seleccionar
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Sitio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Descripción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sitios.map((sitio) => {
                      const sitioId = Number(sitio.id);
                      const checked = selectedSitios.has(sitioId);
                      return (
                        <tr key={sitio.id}>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                              checked={checked}
                              onChange={(event) =>
                                handleToggleSitio(sitioId, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {sitio.nombre}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {sitio.descripcion || 'Sin descripción'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {(cambiosPendientes.asignaciones.length > 0 ||
          cambiosPendientes.eliminaciones.length > 0) && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-[#1C2E4A]">
            <p className="font-semibold">Cambios pendientes:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              {cambiosPendientes.asignaciones.length > 0 && (
                <li>{`Asignar ${cambiosPendientes.asignaciones.length} sitio(s)`}</li>
              )}
              {cambiosPendientes.eliminaciones.length > 0 && (
                <li>{`Quitar ${cambiosPendientes.eliminaciones.length} sitio(s)`}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AsignacionNodosSitios;
