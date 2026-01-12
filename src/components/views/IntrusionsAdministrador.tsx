import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { intrusionesColumns } from '@/components/intrusiones/intrusionesColumns';
import { Intrusion, IntrusionConsolidadoRow } from '@/types';
import { deleteIntrusion, fetchIntrusiones } from '@/services/intrusionesService';
import { parseDbTimestampToLocal } from '@/utils/datetime';

const IntrusionsAdministrador: React.FC = () => {
  const [intrusions, setIntrusions] = useState<Intrusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof IntrusionConsolidadoRow | null>(
    'fechaHoraIntrusion',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
                      <button
                        className="text-red-600 hover:underline font-semibold"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                      >
                        {deletingId === row.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IntrusionsAdministrador;
