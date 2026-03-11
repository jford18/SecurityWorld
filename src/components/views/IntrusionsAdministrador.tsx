import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { intrusionesColumns } from '@/components/intrusiones/intrusionesColumns';
import { Intrusion, IntrusionConsolidadoRow } from '@/types';
import { deleteIntrusion, fetchIntrusiones } from '@/services/intrusionesService';
import { parseDbTimestampToLocal } from '@/utils/datetime';

const formatDateValue = (value?: string | null) => {
  const parsed = parseDbTimestampToLocal(value ?? null);
  if (!parsed) return value ?? '—';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatProtocolDateValue = (value?: string | null) => {
  const formatted = formatDateValue(value);
  if (!value) return 'No registrado';
  return formatted || 'No registrado';
};

const formatProtocolTextValue = (value?: string | null) => value?.trim() || 'No registrado';

const formatGeneralDateValue = (value?: string | null) => {
  if (!value) return 'No registrado';
  return formatDateValue(value) || 'No registrado';
};

const hasSustraccionMaterial = (intrusion: Intrusion) => {
  if (intrusion.material_sustraido_id != null) return true;

  const material = intrusion.material_sustraido?.trim().toLowerCase();
  if (!material) return false;

  return material !== 'no' && material !== 'false';
};

const IntrusionsAdministrador: React.FC = () => {
  const [intrusions, setIntrusions] = useState<Intrusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof IntrusionConsolidadoRow | null>(
    'fechaHoraIntrusion',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewIntrusion, setViewIntrusion] = useState<Intrusion | null>(null);

  const loadIntrusions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIntrusiones();
      setIntrusions(data);
    } catch (err) {
      console.error('Error al cargar intrusiones:', err);
      setError('No se pudo cargar el historial de intrusiones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntrusions();
  }, [loadIntrusions]);

  const handleDelete = async (intrusionId: number | null) => {
    const confirmado = window.confirm('¿Está seguro que desea eliminar esta intrusión?');
    if (!confirmado) return;

    if (!intrusionId) return;

    try {
      setDeletingId(intrusionId);
      await deleteIntrusion(intrusionId);
      await loadIntrusions();
    } catch (err) {
      console.error('Error al eliminar la intrusión:', err);
      setError('No se pudo eliminar la intrusión.');
    } finally {
      setDeletingId(null);
    }
  };

  const intrusionesTableData = useMemo<IntrusionConsolidadoRow[]>(
    () =>
      intrusions.map((intrusion) => ({
        id: intrusion.id ?? null,
        fechaHoraIntrusion: intrusion.fecha_evento ?? null,
        sitio: intrusion.sitio_nombre || intrusion.ubicacion || '',
        tipoIntrusion: intrusion.tipo ?? '',
        llegoAlerta: intrusion.llego_alerta ?? false,
        personalIdentificado: intrusion.personal_identificado?.trim() || '',
      })),
    [intrusions],
  );

  const intrusionsById = useMemo(
    () => new Map(intrusions.map((intrusion) => [intrusion.id, intrusion])),
    [intrusions],
  );

  const handleSort = (field: keyof IntrusionConsolidadoRow) => {
    setSortField((prevField) => {
      if (prevField !== field) {
        setSortDirection('asc');
        return field;
      }
      setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'));
      return field;
    });
  };

  const sortedIntrusiones = useMemo(() => {
    if (!sortField) return intrusionesTableData;

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    return [...intrusionesTableData].sort((a, b) => {
      if (sortField === 'fechaHoraIntrusion') {
        const aDate = parseDbTimestampToLocal(a.fechaHoraIntrusion)?.getTime() ?? 0;
        const bDate = parseDbTimestampToLocal(b.fechaHoraIntrusion)?.getTime() ?? 0;
        return (aDate - bDate) * directionMultiplier;
      }

      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'boolean' || typeof bValue === 'boolean') {
        const aBool = aValue ? 1 : 0;
        const bBool = bValue ? 1 : 0;
        return (aBool - bBool) * directionMultiplier;
      }

      const aText = (aValue ?? '').toString().toLowerCase();
      const bText = (bValue ?? '').toString().toLowerCase();

      return aText.localeCompare(bText) * directionMultiplier;
    });
  }, [intrusionesTableData, sortDirection, sortField]);

  const renderSortIndicator = (field: keyof IntrusionConsolidadoRow) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Intrusiones - Administrador</h3>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Intrusiones</h4>
          {loading && <span className="text-sm text-gray-500">Cargando...</span>}
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {intrusionesColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort(column.key as keyof IntrusionConsolidadoRow)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{column.header}</span>
                      <span className="text-xs">{renderSortIndicator(column.key as keyof IntrusionConsolidadoRow)}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedIntrusiones.length === 0 ? (
                <tr>
                  <td
                    colSpan={intrusionesColumns.length + 1}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No hay intrusiones registradas.
                  </td>
                </tr>
              ) : (
                sortedIntrusiones.map((row) => (
                  <tr key={row.id ?? `${row.sitio}-${row.fechaHoraIntrusion}`} className="hover:bg-gray-50">
                    {intrusionesColumns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {column.render(row)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-blue-600 hover:underline font-semibold"
                          onClick={() => setViewIntrusion(row.id ? intrusionsById.get(row.id) ?? null : null)}
                        >
                          Ver
                        </button>
                        <button
                          className="text-red-600 hover:underline font-semibold"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewIntrusion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[#1C2E4A] text-xl font-semibold">Ver detalle de intrusión</h4>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={() => setViewIntrusion(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-gray-700">Fecha y hora de intrusión</p>
                <p className="text-gray-800">{formatDateValue(viewIntrusion.fecha_evento)}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Fecha y hora de reacción</p>
                <p className="text-gray-800">{formatGeneralDateValue(viewIntrusion.fecha_reaccion)}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Sitio</p>
                <p className="text-gray-800">{viewIntrusion.sitio_nombre || viewIntrusion.ubicacion || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Tipo de intrusión</p>
                <p className="text-gray-800">{viewIntrusion.tipo || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Llegó alerta</p>
                <p className="text-gray-800">{viewIntrusion.llego_alerta ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Personal identificado</p>
                <p className="text-gray-800">{viewIntrusion.personal_identificado || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Medio comunicación</p>
                <p className="text-gray-800">{viewIntrusion.medio_comunicacion_descripcion || '—'}</p>
              </div>
            </div>

            {viewIntrusion.necesita_protocolo && (
              <div className="mt-6 border-l-4 border-yellow-400 bg-yellow-50 rounded-lg p-4">
                <h5 className="text-[#1C2E4A] text-base font-semibold">Protocolo de reacción</h5>
                <p className="text-xs text-gray-600 mt-1 mb-4">
                  Campos requeridos para tipos de evento que activan protocolo
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700">Fecha y hora de reacción enviada</p>
                    <p className="text-gray-800">{formatProtocolDateValue(viewIntrusion.fecha_reaccion_enviada)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Conclusión del evento</p>
                    <p className="text-gray-800">
                      {formatProtocolTextValue(viewIntrusion.conclusion_evento_descripcion)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Fecha y hora de llegada fuerza de reacción</p>
                    <p className="text-gray-800">
                      {formatProtocolDateValue(viewIntrusion.fecha_llegada_fuerza_reaccion)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Fuerza de reacción enviada</p>
                    <p className="text-gray-800">
                      {formatProtocolTextValue(viewIntrusion.fuerza_reaccion_descripcion)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="inline-flex items-center gap-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={hasSustraccionMaterial(viewIntrusion)}
                        disabled
                        readOnly
                        className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A] disabled:opacity-100"
                      />
                      <span className="font-semibold">Sustracción de material</span>
                    </label>
                    {hasSustraccionMaterial(viewIntrusion) && (
                      <p className="text-gray-800 mt-2">
                        {formatProtocolTextValue(viewIntrusion.material_sustraido)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntrusionsAdministrador;
