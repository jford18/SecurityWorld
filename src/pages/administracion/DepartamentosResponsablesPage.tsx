import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createDepartamentoResponsable,
  deleteDepartamentoResponsable,
  DepartamentoResponsable,
  updateDepartamentoResponsable,
  getAllDepartamentosResponsables,
} from '@/services/departamentosResponsablesService';

const toast = {
  success: (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.log(message);
  },
  error: (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.error(message);
  },
};

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;

const normalizeErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const typedError = error as { response?: { data?: { message?: unknown } } };
    const responseData = typedError.response?.data;
    if (
      responseData &&
      typeof responseData === 'object' &&
      'message' in responseData &&
      typeof (responseData as { message?: unknown }).message === 'string'
    ) {
      return (responseData as { message: string }).message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
};

const DepartamentosResponsablesPage = () => {
  const [departamentos, setDepartamentos] = useState<DepartamentoResponsable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const title = useMemo(
    () => (editingId !== null ? 'Editar Departamento Responsable' : 'Registrar Departamento Responsable'),
    [editingId],
  );

  const fetchDepartamentos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllDepartamentosResponsables();
      setDepartamentos(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = normalizeErrorMessage(
        err,
        'No se pudieron obtener los departamentos responsables. Intente nuevamente.',
      );
      setError(message);
      toast.error(message);
      setDepartamentos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartamentos();
  }, []);

  const resetForm = () => {
    setNombre('');
    setEditingId(null);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setFormError('El nombre es obligatorio');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId !== null) {
        await updateDepartamentoResponsable(editingId, { nombre: nombreLimpio });
        toast.success('Departamento responsable actualizado correctamente');
      } else {
        await createDepartamentoResponsable({ nombre: nombreLimpio });
        toast.success('Departamento responsable creado correctamente');
      }
      resetForm();
      fetchDepartamentos();
    } catch (err) {
      const message = normalizeErrorMessage(err, 'No se pudo guardar el departamento responsable');
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (departamento: DepartamentoResponsable) => {
    setEditingId(departamento.id);
    setNombre(departamento.nombre ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number, nombreDepartamento: string) => {
    const confirmed = window.confirm(
      `¿Desea eliminar el departamento responsable "${nombreDepartamento}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDepartamentoResponsable(id);
      toast.success('Departamento responsable eliminado correctamente');
      fetchDepartamentos();
    } catch (err) {
      const message = normalizeErrorMessage(err, 'No se pudo eliminar el departamento responsable');
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-yellow-600 font-semibold">Administración</p>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Departamento Responsable</h1>
          <p className="text-sm text-gray-500">Administra los departamentos responsables utilizados en el sistema.</p>
        </div>
        {editingId !== null && (
          <button type="button" className={secondaryButtonClasses} onClick={resetForm}>
            Cancelar edición
          </button>
        )}
      </header>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">{title}</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
              Nombre del departamento responsable
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
              placeholder="Ingrese el nombre"
              disabled={submitting}
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={primaryButtonClasses} disabled={submitting}>
              {submitting ? 'Guardando...' : editingId !== null ? 'Actualizar' : 'Crear'}
            </button>
            <button type="button" className={secondaryButtonClasses} onClick={resetForm} disabled={submitting}>
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Listado de Departamentos Responsables</h2>
            {loading && <span className="text-sm text-gray-500">Cargando...</span>}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {departamentos.length === 0 && !loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay registros disponibles.
                  </td>
                </tr>
              ) : (
                departamentos.map((departamento) => (
                  <tr key={departamento.id}>
                    <td className="px-6 py-4 text-sm text-gray-700">{departamento.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{departamento.nombre}</td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClasses}
                          onClick={() => handleEdit(departamento)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClasses}
                          onClick={() => handleDelete(departamento.id, departamento.nombre)}
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
      </section>
    </div>
  );
};

export default DepartamentosResponsablesPage;
