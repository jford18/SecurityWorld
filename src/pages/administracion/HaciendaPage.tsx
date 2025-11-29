import React, { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import type { Hacienda } from '../../types';
import { deleteHacienda, fetchHaciendas } from '../../services/haciendaService';
import HaciendaForm from './HaciendaForm.tsx';

const baseButtonClasses =
  'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const primaryButtonClasses = `${baseButtonClasses} bg-[#1C2E4A] text-white hover:bg-[#243b55] focus:ring-[#1C2E4A]`;
const secondaryButtonClasses = `${baseButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-300`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-600 text-white hover:bg-red-700 focus:ring-red-600`;

const formatTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
    now.getHours(),
  ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
};

type ModalMode = 'create' | 'edit';

const HaciendaPage: React.FC = () => {
  const [haciendas, setHaciendas] = useState<Hacienda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selected, setSelected] = useState<Hacienda | null>(null);

  const loadHaciendas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchHaciendas();
      setHaciendas(data);
    } catch (error) {
      console.error('Error al cargar haciendas', error);
      const message = (error as Error).message || 'Error al cargar haciendas';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHaciendas();
  }, [loadHaciendas]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelected(null);
    setModalOpen(true);
  };

  const openEditModal = (hacienda: Hacienda) => {
    setModalMode('edit');
    setSelected(hacienda);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleDelete = async (hacienda: Hacienda) => {
    const confirmed = window.confirm(
      `¿Deseas eliminar la hacienda "${hacienda.nombre}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteHacienda(hacienda.id);
      alert('Hacienda eliminada correctamente');
      loadHaciendas();
    } catch (error) {
      const message = (error as Error).message || 'Error al eliminar hacienda';
      alert(message);
    }
  };

  const handleExportToExcel = () => {
    if (loading || haciendas.length === 0) return;

    const formattedRows = haciendas.map((hacienda) => ({
      ID: hacienda.id ?? '—',
      Nombre: hacienda.nombre ?? '—',
      Dirección: hacienda.direccion ?? '—',
      Activo: hacienda.activo ? 'Sí' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Haciendas');

    const filename = `mantenimiento_haciendas_${formatTimestamp()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Catálogo de Haciendas</h1>
          <p className="text-sm text-gray-500">
            Administra las haciendas disponibles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClasses}
            onClick={handleExportToExcel}
            disabled={loading || haciendas.length === 0}
          >
            Exportar a Excel
          </button>
          <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
            Nueva Hacienda
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#F9E79F]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Nombre
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Dirección
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Activo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Cargando información...
                  </td>
                </tr>
              ) : haciendas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay haciendas registradas.
                  </td>
                </tr>
              ) : (
                haciendas.map((hacienda) => (
                  <tr key={hacienda.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{hacienda.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{hacienda.nombre}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{hacienda.direccion}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{hacienda.activo ? 'Sí' : 'No'}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className={secondaryButtonClasses}
                          onClick={() => openEditModal(hacienda)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClasses}
                          onClick={() => handleDelete(hacienda)}
                        >
                          Eliminar
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

      {modalOpen && (
        <HaciendaForm
          mode={modalMode}
          hacienda={selected}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            loadHaciendas();
          }}
        />
      )}
    </div>
  );
};

export default HaciendaPage;
