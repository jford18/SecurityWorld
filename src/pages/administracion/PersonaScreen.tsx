import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  create as createPersona,
  getAll as getPersonas,
  remove as removePersona,
  update as updatePersona,
} from '../../services/persona.service';
import { getAll as getCargos } from '../../services/cargo.service';

interface Persona {
  id: number;
  nombre: string;
  apellido: string;
  cargo_id: number;
  cargo_descripcion?: string;
  estado: boolean;
  fecha_creacion: string;
}

interface PersonaFormState {
  nombre: string;
  apellido: string;
  cargo_id: number;
  estado: boolean;
}

interface CargoOption {
  id: number;
  descripcion: string;
  activo: boolean;
}

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

const initialFormState: PersonaFormState = {
  nombre: '',
  apellido: '',
  cargo_id: 0,
  estado: true,
};

const PersonaScreen: React.FC = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargos, setCargos] = useState<CargoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cargosError, setCargosError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [formState, setFormState] = useState<PersonaFormState>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPersonas = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const data = await getPersonas(search);
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setPersonas(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar personas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las personas');
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCargos = useCallback(async () => {
    try {
      const data = await getCargos();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      const activeCargos = data.filter((cargo) => cargo.activo !== false);
      setCargos(activeCargos);
      setCargosError('');
    } catch (err) {
      console.error('Error al cargar cargos:', err);
      setCargosError(err instanceof Error ? err.message : 'Error al cargar los cargos');
      setCargos([]);
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  useEffect(() => {
    fetchCargos();
  }, [fetchCargos]);

  const filteredPersonas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return personas;
    }

    return personas.filter((persona) =>
      [persona.nombre, persona.apellido, persona.cargo_descripcion, persona.id]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(term))
    );
  }, [personas, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPersonas.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPersonas.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPersonas, currentPage]);

  const handleExportToExcel = () => {
    if (loading || currentItems.length === 0) return;

    const formattedRows = currentItems.map((persona) => ({
      ID: persona.id ?? '—',
      Nombre: persona.nombre ?? '—',
      Apellido: persona.apellido ?? '—',
      Cargo: persona.cargo_descripcion ?? '—',
      Estado: persona.estado ? 'Activo' : 'Inactivo',
      'Fecha Creación': persona.fecha_creacion
        ? new Date(persona.fecha_creacion).toLocaleString()
        : '—',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personas');

    const filename = `mantenimiento_personas_${formatTimestamp()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedPersona(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (persona: Persona) => {
    setIsEditing(true);
    setSelectedPersona(persona);
    setFormState({
      nombre: persona.nombre ?? '',
      apellido: persona.apellido ?? '',
      cargo_id: persona.cargo_id,
      estado: persona.estado,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const nombre = formState.nombre.trim();
    const apellido = formState.apellido.trim();
    const cargoId = formState.cargo_id;

    if (!nombre) {
      setFormError('El nombre es obligatorio');
      return;
    }

    if (!apellido) {
      setFormError('El apellido es obligatorio');
      return;
    }

    if (!Number.isInteger(cargoId) || cargoId <= 0) {
      setFormError('Debes seleccionar un cargo válido');
      return;
    }

    try {
      if (isEditing && selectedPersona) {
        await updatePersona(selectedPersona.id, {
          nombre,
          apellido,
          cargo_id: cargoId,
          estado: formState.estado,
        });
        alert('Persona actualizada correctamente');
      } else {
        await createPersona({
          nombre,
          apellido,
          cargo_id: cargoId,
          estado: formState.estado,
        });
        alert('Persona creada correctamente');
      }
      await fetchPersonas(searchTerm);
      closeModal();
    } catch (err: any) {
      console.error(err);

      if (err?.status === 400 && err?.code === 'PERSONA_DUPLICADA') {
        setFormError('Ya existe una persona con el mismo nombre, apellido y cargo.');
        return;
      }

      setFormError(err instanceof Error ? err.message : 'Error al guardar la persona');
    }
  };

  const handleStatusChange = async (persona: Persona) => {
    if (persona.estado) {
      const confirmed = window.confirm(
        `¿Deseas inactivar a ${persona.nombre} ${persona.apellido}?`
      );

      if (!confirmed) {
        return;
      }

      try {
        await removePersona(persona.id);
        alert('Persona inactivada correctamente');
        await fetchPersonas(searchTerm);
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : 'Error al inactivar la persona');
      }
      return;
    }

    try {
      await updatePersona(persona.id, { estado: true });
      alert('Persona activada correctamente');
      await fetchPersonas(searchTerm);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al activar la persona');
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    fetchPersonas(value);
    setCurrentPage(1);
  };

  const renderEstado = (estado: boolean) => (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        estado ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {estado ? 'Activo' : 'Inactivo'}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Personas</h1>
          <p className="text-sm text-gray-500">
            Administra las personas registradas y su asignación de cargos.
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
            Nueva Persona
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
              placeholder="Buscar por nombre, apellido o cargo"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando personas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredPersonas.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron personas.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#1C2E4A]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Apellido
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Cargo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Fecha Creación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {currentItems.map((persona) => (
                    <tr key={persona.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{persona.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{persona.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{persona.apellido}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {persona.cargo_descripcion ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{renderEstado(persona.estado)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {persona.fecha_creacion
                          ? new Date(persona.fecha_creacion).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(persona)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={persona.estado ? dangerButtonClasses : successButtonClasses}
                            onClick={() => handleStatusChange(persona)}
                          >
                            {persona.estado ? 'Eliminar' : 'Activar'}
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
              {isEditing ? 'Editar Persona' : 'Nueva Persona'}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Nombre
                <input
                  type="text"
                  value={formState.nombre}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      nombre: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa el nombre"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Apellido
                <input
                  type="text"
                  value={formState.apellido}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      apellido: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa el apellido"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Cargo
                <select
                  value={formState.cargo_id > 0 ? formState.cargo_id : ''}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      cargo_id: Number(event.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                >
                  <option value="" disabled>
                    Selecciona un cargo
                  </option>
                  {cargos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.descripcion}
                    </option>
                  ))}
                </select>
                {cargosError && (
                  <p className="mt-1 text-xs text-red-600">{cargosError}</p>
                )}
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.estado}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      estado: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                />
                Activo
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

export default PersonaScreen;
