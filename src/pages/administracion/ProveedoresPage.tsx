import React, { useCallback, useEffect, useState } from "react";
import {
  createProveedor,
  deleteProveedor,
  getProveedores,
  updateProveedor,
} from "@/services/proveedoresService";

const toast = {
  success: (message: string) => {
    if (typeof window !== "undefined") {
      window.alert(message);
    }
    console.log(message);
  },
  error: (message: string) => {
    if (typeof window !== "undefined") {
      window.alert(message);
    }
    console.error(message);
  },
};

const baseButtonClasses =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors";
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
    if (maybeResponse?.data?.message) {
      return maybeResponse.data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
};

const ProveedoresPage: React.FC = () => {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");

  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const [identificacion, setIdentificacion] = useState<string>("");
  const [telefono, setTelefono] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");
  const [activo, setActivo] = useState<boolean>(true);

  const [formError, setFormError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchProveedores = useCallback(async () => {
    try {
      const searchTerm = search.trim();
      const data = await getProveedores(searchTerm ? { q: searchTerm } : undefined);
      setProveedores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("[ERROR] No se pudieron cargar los proveedores:", error);
      const message = resolveErrorMessage(error, "No se pudieron cargar los proveedores");
      toast.error(message);
      setProveedores([]);
    }
  }, [search]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const limpiarFormulario = () => {
    setProveedorId(null);
    setNombre("");
    setIdentificacion("");
    setTelefono("");
    setDireccion("");
    setActivo(true);
    setFormError("");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!nombre.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      identificacion: identificacion.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      activo,
    };

    try {
      setSubmitting(true);
      if (proveedorId) {
        await updateProveedor(proveedorId, payload);
        toast.success("Proveedor actualizado correctamente");
      } else {
        await createProveedor(payload);
        toast.success("Proveedor guardado correctamente");
      }
      await fetchProveedores();
      limpiarFormulario();
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo guardar el proveedor");
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (p: any) => {
    setProveedorId(p.id);
    setNombre(p.nombre ?? "");
    setIdentificacion(p.identificacion ?? "");
    setTelefono(p.telefono ?? "");
    setDireccion(p.direccion ?? "");
    setActivo(Boolean(p.activo));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    const proveedor = proveedores.find((p) => p.id === id);
    const confirmed = window.confirm(
      `¿Deseas eliminar al proveedor "${proveedor?.nombre || id}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteProveedor(id);
      toast.success("Proveedor eliminado correctamente");
      await fetchProveedores();
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo eliminar el proveedor");
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Proveedores</h1>
          <p className="text-sm text-gray-500">Administra los proveedores registrados en el sistema.</p>
        </div>
        {proveedorId !== null && (
          <button type="button" className={secondaryButtonClasses} onClick={limpiarFormulario}>
            Cancelar edición
          </button>
        )}
      </header>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">
          {proveedorId !== null ? "Editar proveedor" : "Registrar nuevo proveedor"}
        </h2>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Nombre *</span>
              <input
                type="text"
                name="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Nombre del proveedor"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Identificación</span>
              <input
                type="text"
                name="identificacion"
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="RUC / Cédula"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Teléfono</span>
              <input
                type="text"
                name="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Número de contacto"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Dirección</span>
              <input
                type="text"
                name="direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Dirección del proveedor"
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="activo"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
              />
              <span className="font-medium text-gray-700">Proveedor activo</span>
            </label>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={primaryButtonClasses} disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className={secondaryButtonClasses} onClick={limpiarFormulario}>
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Listado de proveedores</h2>
            <p className="text-sm text-gray-500">{`Se encontraron ${proveedores.length} proveedor(es)`}</p>
          </div>
          <label className="flex w-full items-center gap-3 md:w-auto">
            <span className="text-sm font-medium text-gray-700">Buscar</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full md:w-64 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
              placeholder="Buscar por nombre o identificación"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Identificación</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Dirección</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Activo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {Array.isArray(proveedores) && proveedores.length > 0 ? (
                proveedores.map((proveedor) => (
                  <tr key={proveedor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{proveedor.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{proveedor.nombre || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{proveedor.identificacion || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{proveedor.telefono || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{proveedor.direccion || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          Boolean(proveedor.activo)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {Boolean(proveedor.activo) ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm sticky right-0 bg-white">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClasses}
                          onClick={() => handleEdit(proveedor)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClasses}
                          onClick={() => handleDelete(proveedor.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-4">
                    No hay proveedores disponibles
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

export default ProveedoresPage;
