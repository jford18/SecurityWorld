import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import AutocompleteComboBox from "../../components/ui/AutocompleteComboBox.jsx";

const toast = {
  success: (message) => {
    if (typeof window !== "undefined") {
      window.alert(message);
    }
    console.log(message);
  },
  error: (message) => {
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

const resolveErrorMessage = (error, fallback) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
};

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");

  const [haciendas, setHaciendas] = useState([]);
  const [tipoAreas, setTipoAreas] = useState([]);

  const [clienteId, setClienteId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [activo, setActivo] = useState(true);
  const [selectedHacienda, setSelectedHacienda] = useState(null);
  const [selectedTipoArea, setSelectedTipoArea] = useState(null);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchClientes = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/clientes", {
        params: { q: search || undefined },
      });
      setClientes(data || []);
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudieron cargar los clientes");
      toast.error(message);
      setClientes([]);
    }
  }, [search]);

  const fetchComboBoxData = useCallback(async () => {
    try {
      const [haciendasRes, tipoAreasRes] = await Promise.all([
        axios.get("/api/haciendas"),
        axios.get("/api/tipo_area"),
      ]);
      setHaciendas(haciendasRes.data.data || []);
      setTipoAreas(tipoAreasRes.data.data || []);
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudieron cargar los datos para los combos");
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    fetchComboBoxData();
  }, [fetchComboBoxData]);

  const limpiarFormulario = () => {
    setClienteId(null);
    setNombre("");
    setIdentificacion("");
    setTelefono("");
    setActivo(true);
    setSelectedHacienda(null);
    setSelectedTipoArea(null);
    setFormError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!nombre || !identificacion) {
      setFormError("Nombre e identificación son obligatorios");
      return;
    }

    const payload = {
      nombre,
      identificacion,
      telefono,
      activo,
      hacienda_id: selectedHacienda?.id ?? null,
      tipo_area_id: selectedTipoArea?.id ?? null,
    };

    try {
      setSubmitting(true);
      if (clienteId) {
        await axios.put(`/api/clientes/${clienteId}`, payload);
        toast.success("Cliente actualizado correctamente");
      } else {
        await axios.post(`/api/clientes`, payload);
        toast.success("Cliente guardado correctamente");
      }
      await fetchClientes();
      limpiarFormulario();
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo guardar el cliente");
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (c) => {
    setClienteId(c.id);
    setNombre(c.nombre ?? "");
    setIdentificacion(c.identificacion ?? "");
    setTelefono(c.telefono ?? "");
    setActivo(Boolean(c.activo));
    setSelectedHacienda(c.hacienda_id ? { id: c.hacienda_id, nombre: c.hacienda_nombre ?? "" } : null);
    setSelectedTipoArea(c.tipo_area_id ? { id: c.tipo_area_id, nombre: c.tipo_area_nombre ?? "" } : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const cliente = clientes.find(c => c.id === id);
    const confirmed = window.confirm(
      `¿Deseas eliminar al cliente "${cliente?.nombre || id}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`/api/clientes/${id}`);
      toast.success("Cliente eliminado correctamente");
      await fetchClientes();
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo eliminar el cliente");
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">
            Mantenimiento de Clientes
          </h1>
          <p className="text-sm text-gray-500">
            Registra, edita y elimina clientes del sistema administrativo.
          </p>
        </div>
        {clienteId !== null && (
          <button type="button" className={secondaryButtonClasses} onClick={limpiarFormulario}>
            Cancelar edición
          </button>
        )}
      </header>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">
          {clienteId !== null ? "Editar cliente" : "Registrar nuevo cliente"}
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
                placeholder="Nombre del cliente"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Identificación *</span>
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
                type="tel"
                name="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Número de contacto"
              />
            </label>
            <div className="md:col-span-1">
              <AutocompleteComboBox
                label="Hacienda"
                items={haciendas}
                value={selectedHacienda}
                onChange={setSelectedHacienda}
                placeholder="Buscar hacienda"
                displayField="nombre"
                valueField="id"
              />
            </div>
            <div className="md:col-span-1">
              <AutocompleteComboBox
                label="Tipo Área"
                items={tipoAreas}
                value={selectedTipoArea}
                onChange={setSelectedTipoArea}
                placeholder="Buscar tipo de área"
                displayField="nombre"
                valueField="id"
              />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="activo"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
              />
              <span className="font-medium text-gray-700">Cliente activo</span>
            </label>
          </div>

          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}

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
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Listado de clientes</h2>
            <p className="text-sm text-gray-500">
              {`Se encontraron ${clientes.length} cliente(s)`}
            </p>
          </div>
          <label className="flex w-full items-center gap-3 md:w-auto">
            <span className="text-sm font-medium text-gray-700">Buscar</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full md:w-64 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
              placeholder="Buscar por nombre, identificación o teléfono"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Identificación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Activo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {clientes.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{cliente.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {cliente.nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cliente.identificacion || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cliente.telefono || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          Boolean(cliente.activo)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {Boolean(cliente.activo) ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm sticky right-0 bg-white">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClasses}
                          onClick={() => handleEdit(cliente)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClasses}
                          onClick={() => handleDelete(cliente.id)}
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

export default Clientes;
