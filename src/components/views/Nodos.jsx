// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { create, deleteNodo, getAll, update } from '../../services/nodos.service';
import { getProveedores } from '../../services/proveedoresService';

const ITEMS_PER_PAGE = 10;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;
const successButtonClasses = `${baseButtonClasses} bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500`;

const formatTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
    now.getHours(),
  ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
};

const initialFormState = {
  nombre: '',
  ip: '',
  proveedorId: '',
};

const Nodos = () => {
  const [nodos, setNodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNodo, setSelectedNodo] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [proveedoresError, setProveedoresError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    id: '',
    nombre: '',
    ip: '',
    cliente: '',
    estado: '',
    fechaCreacion: '',
  });
  const [sortConfig, setSortConfig] = useState(null);

  const fetchNodos = async () => {
    try {
      setLoading(true);
      const data = await getAll();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setNodos(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar nodos:', err);
      setError(err?.message || 'Error al cargar los nodos');
    } finally {
      setLoading(false);
    }
  };

  const fetchProveedores = async () => {
    try {
      setLoadingProveedores(true);
      const data = await getProveedores();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor de proveedores');
      }
      setProveedores(data);
      setProveedoresError('');
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
      setProveedoresError(err?.message || 'Error al cargar los proveedores');
    } finally {
      setLoadingProveedores(false);
    }
  };

  useEffect(() => {
    fetchNodos();
    fetchProveedores();
  }, []);

  const getClienteNombre = (nodo) =>
    String(
      nodo.cliente_nombre ??
        nodo.clienteNombre ??
        nodo.proveedor_nombre ??
        nodo.proveedorNombre ??
        ''
    );

  const getComparableValue = (nodo, key) => {
    switch (key) {
      case 'cliente':
        return getClienteNombre(nodo);
      case 'estado':
        return nodo.activo ? 'activo' : 'inactivo';
      case 'fechaCreacion':
      case 'fecha_creacion':
        return nodo.fecha_creacion ? new Date(nodo.fecha_creacion).getTime() : 0;
      case 'id':
        return Number(nodo.id) || 0;
      default:
        return String(nodo[key] ?? '');
    }
  };

  const filteredNodos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filterId = filters.id.trim().toLowerCase();
    const filterNombre = filters.nombre.trim().toLowerCase();
    const filterIp = filters.ip.trim().toLowerCase();
    const filterCliente = filters.cliente.trim().toLowerCase();
    const filterEstado = filters.estado.trim().toLowerCase();
    const filterFecha = filters.fechaCreacion.trim().toLowerCase();

    return nodos.filter((nodo) => {
      const matchesSearch = !term
        ? true
        : [
            nodo.nombre,
            nodo.id,
            nodo.ip,
            nodo.proveedor_nombre,
            nodo.proveedorNombre,
            nodo.cliente_nombre,
            nodo.clienteNombre,
          ].some((value) =>
            String(value ?? '')
              .toLowerCase()
              .includes(term)
          );

      if (!matchesSearch) {
        return false;
      }

      const fechaTexto = nodo.fecha_creacion
        ? new Date(nodo.fecha_creacion).toLocaleString().toLowerCase()
        : '';

      return (
        String(nodo.id ?? '')
          .toLowerCase()
          .includes(filterId) &&
        String(nodo.nombre ?? '')
          .toLowerCase()
          .includes(filterNombre) &&
        String(nodo.ip ?? '')
          .toLowerCase()
          .includes(filterIp) &&
        getClienteNombre(nodo).toLowerCase().includes(filterCliente) &&
        (filters.estado.trim() === ''
          ? true
          : (nodo.activo ? 'activo' : 'inactivo')
              .toLowerCase()
              .includes(filterEstado)) &&
        fechaTexto.includes(filterFecha)
      );
    });
  }, [nodos, searchTerm, filters]);

  const sortedNodos = useMemo(() => {
    if (!sortConfig) return filteredNodos;

    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    return [...filteredNodos].sort((a, b) => {
      const aValue = getComparableValue(a, sortConfig.key);
      const bValue = getComparableValue(b, sortConfig.key);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (aValue === bValue) return 0;
        return aValue > bValue ? directionMultiplier : -directionMultiplier;
      }

      return String(aValue)
        .toLowerCase()
        .localeCompare(String(bValue).toLowerCase(), 'es') * directionMultiplier;
    });
  }, [filteredNodos, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedNodos.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedNodos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedNodos, currentPage]);

  const handleExportToExcel = () => {
    if (loading || currentItems.length === 0) return;

    const formattedRows = currentItems.map((nodo) => ({
      ID: nodo.id ?? '—',
      Nombre: nodo.nombre ?? '—',
      IP: nodo.ip || '—',
      Proveedor: getClienteNombre(nodo) || '—',
      Activo: nodo.activo ? 'Sí' : 'No',
      'Fecha creación': nodo.fecha_creacion
        ? new Date(nodo.fecha_creacion).toLocaleString()
        : '—',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nodos');

    const filename = `mantenimiento_nodos_${formatTimestamp()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedNodo(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (nodo) => {
    setIsEditing(true);
    setSelectedNodo(nodo);
    setFormState({
      nombre: nodo.nombre ?? '',
      ip: nodo.ip ?? '',
      proveedorId: nodo.proveedor_id ?? nodo.proveedorId ?? '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const nombre = formState.nombre.trim();
    const ip = formState.ip.trim();
    const proveedorIdValue =
      formState.proveedorId === '' || formState.proveedorId === null
        ? null
        : Number(formState.proveedorId);

    if (!nombre) {
      setFormError('El nombre del nodo es obligatorio');
      return;
    }

    if (formState.proveedorId !== '' && Number.isNaN(proveedorIdValue)) {
      setFormError('Selecciona un proveedor válido');
      return;
    }

    const duplicated = nodos.some(
      (nodo) =>
        nodo.nombre.toLowerCase() === nombre.toLowerCase() &&
        nodo.id !== (selectedNodo?.id ?? null)
    );

    if (duplicated) {
      setFormError('Ya existe un nodo con ese nombre');
      return;
    }

    try {
      const payload = {
        nombre,
        ip: ip || null,
        proveedorId: proveedorIdValue,
      };

      if (isEditing && selectedNodo) {
        await update(selectedNodo.id, payload);
        alert('Nodo actualizado correctamente');
      } else {
        await create(payload);
        alert('Nodo creado correctamente');
      }
      await fetchNodos();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Error al guardar el nodo');
    }
  };

  const handleDelete = async (nodo) => {
    const confirmed = window.confirm(
      '¿Está seguro de eliminar este nodo? Esta acción no se puede deshacer.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteNodo(nodo.id);
      alert('Nodo eliminado correctamente');
      setNodos((prev) => prev.filter((item) => item.id !== nodo.id));
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Error al eliminar el nodo');
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== column) {
        return { key: column, direction: 'asc' };
      }

      return { key: column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderSortIcon = (column) => {
    if (!sortConfig || sortConfig.key !== column) {
      return '▼▲';
    }

    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const renderStatus = (isActive) => (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        isActive
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-200 text-gray-600'
      }`}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Nodos</h1>
          <p className="text-sm text-gray-500">
            Gestiona los nodos disponibles para las operaciones del sistema.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClasses}
            onClick={handleExportToExcel}
            disabled={loading || currentItems.length === 0}
          >
            Exportar a Excel
          </button>
          <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
            Nuevo Nodo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Buscar</span>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Buscar por nombre o ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando nodos...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredNodos.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron nodos.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-[#1C2E4A] text-white">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort('id')}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <span>ID</span>
                          <span>{renderSortIcon('id')}</span>
                        </button>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                          placeholder="Filtrar…"
                          value={filters.id}
                          onChange={(e) => handleFilterChange('id', e.target.value)}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort('nombre')}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <span>Nombre</span>
                          <span>{renderSortIcon('nombre')}</span>
                        </button>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                          placeholder="Filtrar…"
                          value={filters.nombre}
                          onChange={(e) => handleFilterChange('nombre', e.target.value)}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort('ip')}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <span>IP</span>
                          <span>{renderSortIcon('ip')}</span>
                        </button>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                          placeholder="Filtrar…"
                          value={filters.ip}
                          onChange={(e) => handleFilterChange('ip', e.target.value)}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort('cliente')}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <span>Proveedor</span>
                          <span>{renderSortIcon('cliente')}</span>
                        </button>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                          placeholder="Filtrar…"
                          value={filters.cliente}
                          onChange={(e) => handleFilterChange('cliente', e.target.value)}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort('estado')}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <span>Estado</span>
                          <span>{renderSortIcon('estado')}</span>
                        </button>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                          placeholder="Filtrar…"
                          value={filters.estado}
                          onChange={(e) => handleFilterChange('estado', e.target.value)}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort('fechaCreacion')}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <span>Fecha creación</span>
                          <span>{renderSortIcon('fechaCreacion')}</span>
                        </button>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                          placeholder="Filtrar…"
                          value={filters.fechaCreacion}
                          onChange={(e) => handleFilterChange('fechaCreacion', e.target.value)}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {currentItems.map((nodo) => (
                    <tr key={nodo.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{nodo.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{nodo.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{nodo.ip || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {nodo.proveedor_nombre || nodo.proveedorNombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{renderStatus(nodo.activo)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {nodo.fecha_creacion
                          ? new Date(nodo.fecha_creacion).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(nodo)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={dangerButtonClasses}
                            onClick={() => handleDelete(nodo)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-[#1C2E4A]">
              {isEditing ? 'Editar Nodo' : 'Nuevo Nodo'}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Nombre
                <input
                  type="text"
                  value={formState.nombre}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa el nombre del nodo"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                IP
                <input
                  type="text"
                  value={formState.ip}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, ip: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa la IP del nodo"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Proveedor
                <select
                  value={formState.proveedorId ?? ''}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      proveedorId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  disabled={loadingProveedores}
                >
                  <option value="">Selecciona un proveedor</option>
                  {proveedores.map((proveedor) => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
                {loadingProveedores && (
                  <p className="text-xs text-gray-500 mt-1">Cargando proveedores...</p>
                )}
                {proveedoresError && (
                  <p className="text-xs text-red-600 mt-1">{proveedoresError}</p>
                )}
              </label>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nodos;
