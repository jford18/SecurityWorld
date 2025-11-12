// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../services/api";
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

const CLIENTES_API_URL = `${API_BASE_URL}/api/clientes`;

const initialFormState = {
  nombre: "",
  identificacion: "",
  direccion: "",
  telefono: "",
  activo: true,
  hacienda_id: "",
  tipo_area_id: "",
};

const baseButtonClasses =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors";
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "t", "on", "activo", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "f", "off", "inactivo", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
};

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

const parseClientesResponse = (response) => {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (response?.data?.data && Array.isArray(response.data.data)) {
    return response.data.data;
  }

  return [];
};

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true);
      setGlobalError("");
      const response = await axios.get(CLIENTES_API_URL, {
        withCredentials: true,
      });
      const data = parseClientesResponse(response);
      setClientes(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudieron cargar los clientes");
      setGlobalError(message);
      toast.error(message);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleComboBoxChange = (name, value) => {
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingId(null);
    setFormError("");
    setSubmitting(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    const nombre = formState.nombre.trim();
    const identificacion = formState.identificacion.trim();
    const direccion = formState.direccion.trim();
    const telefono = formState.telefono.trim();
    const activo = normalizeBoolean(formState.activo, true);

    if (!nombre || !identificacion) {
      setFormError("Nombre e identificación son obligatorios");
      return;
    }

    const payload = {
      nombre,
      identificacion,
      direccion,
      telefono,
      activo,
      hacienda_id: formState.hacienda_id,
      tipo_area_id: formState.tipo_area_id,
    };

    try {
      setSubmitting(true);
      if (editingId !== null) {
        await axios.put(`${CLIENTES_API_URL}/${editingId}`, payload, {
          withCredentials: true,
        });
        toast.success("Cliente actualizado correctamente");
      } else {
        await axios.post(CLIENTES_API_URL, payload, {
          withCredentials: true,
        });
        toast.success("Cliente guardado correctamente");
      }
      await fetchClientes();
      resetForm();
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo guardar el cliente");
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (cliente) => {
    setEditingId(cliente.id);
    setFormState({
      nombre: cliente.nombre ?? "",
      identificacion: cliente.identificacion ?? "",
      direccion: cliente.direccion ?? "",
      telefono: cliente.telefono ?? "",
      activo: normalizeBoolean(cliente.activo, true),
      hacienda_id: cliente.hacienda_id ?? "",
      tipo_area_id: cliente.tipo_area_id ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (cliente) => {
    const confirmed = window.confirm(
      `¿Deseas eliminar al cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`${CLIENTES_API_URL}/${cliente.id}`, {
        withCredentials: true,
      });
      toast.success("Cliente eliminado correctamente");
      await fetchClientes();
      if (editingId === cliente.id) {
        resetForm();
      }
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo eliminar el cliente");
      toast.error(message);
    }
  };

  const filteredClientes = useMemo(() => {
    const term = filterTerm.trim().toLowerCase();
    if (!term) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const valuesToSearch = [
        cliente.id,
        cliente.nombre,
        cliente.identificacion,
        cliente.telefono,
        cliente.direccion,
      ];

      return valuesToSearch.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [clientes, filterTerm]);

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
        {editingId !== null && (
          <button type="button" className={secondaryButtonClasses} onClick={resetForm}>
            Cancelar edición
          </button>
        )}
      </header>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">
          {editingId !== null ? "Editar cliente" : "Registrar nuevo cliente"}
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Nombre *</span>
              <input
                type="text"
                name="nombre"
                value={formState.nombre}
                onChange={handleInputChange}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Nombre del cliente"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Identificación *</span>
              <input
                type="text"
                name="identificacion"
                value={formState.identificacion}
                onChange={handleInputChange}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="RUC / Cédula"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="font-medium text-gray-700">Dirección</span>
              <input
                type="text"
                name="direccion"
                value={formState.direccion}
                onChange={handleInputChange}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Dirección principal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Teléfono</span>
              <input
                type="tel"
                name="telefono"
                value={formState.telefono}
                onChange={handleInputChange}
                className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Número de contacto"
              />
            </label>
            <div className="md:col-span-1">
              <AutocompleteComboBox
                label="Hacienda"
                endpoint={`${API_BASE_URL}/api/haciendas`}
                value={formState.hacienda_id}
                onChange={(value) => handleComboBoxChange("hacienda_id", value)}
                placeholder="Buscar hacienda"
                displayField="nombre"
                valueField="id"
              />
            </div>
            <div className="md:col-span-1">
              <AutocompleteComboBox
                label="Tipo Área"
                endpoint={`${API_BASE_URL}/api/tipo_area`}
                value={formState.tipo_area_id}
                onChange={(value) => handleComboBoxChange("tipo_area_id", value)}
                placeholder="Buscar tipo de área"
                displayField="nombre"
                valueField="id"
              />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="activo"
                checked={Boolean(formState.activo)}
                onChange={handleInputChange}
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
            <button type="button" className={secondaryButtonClasses} onClick={resetForm}>
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
              {loading
                ? "Cargando clientes..."
                : `Se encontraron ${filteredClientes.length} cliente(s)`}
            </p>
          </div>
          <label className="flex w-full items-center gap-3 md:w-auto">
            <span className="text-sm font-medium text-gray-700">Buscar</span>
            <input
              type="text"
              value={filterTerm}
              onChange={(event) => setFilterTerm(event.target.value)}
              className="w-full md:w-64 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
              placeholder="Buscar por nombre, identificación o teléfono"
            />
          </label>
        </div>

        {globalError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {globalError}
          </div>
        )}

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
              {filteredClientes.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>
                    {loading ? "Cargando clientes..." : "No se encontraron clientes"}
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
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
                          normalizeBoolean(cliente.activo, true)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {normalizeBoolean(cliente.activo, true) ? "Activo" : "Inactivo"}
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
                          onClick={() => handleDelete(cliente)}
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
