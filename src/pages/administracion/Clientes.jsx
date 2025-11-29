import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/services/api";
import {
  createCliente,
  getAllClientes,
  updateCliente,
} from "@/services/clientes.service";
import { getTiposServicio } from "@/services/tipoServicioService";
import {
  addPersonaToCliente,
  getPersonasByCliente,
  getPersonasDisponiblesParaCliente,
  removePersonaFromCliente,
} from "@/services/clientePersona.service";

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

const formatTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours(),
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
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

const ClienteFormFields = ({
  nombre,
  identificacion,
  tipoServicioId,
  activo,
  tiposServicio,
  tiposServicioLoading,
  tiposServicioError,
  formError,
  onNombreChange,
  onIdentificacionChange,
  onTipoServicioChange,
  onActivoChange,
}) => (
  <>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Nombre *</span>
        <input
          type="text"
          name="nombre"
          value={nombre}
          onChange={(event) => onNombreChange(event.target.value)}
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
          onChange={(event) => onIdentificacionChange(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
          placeholder="RUC / Cédula"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Tipo de servicio *</span>
        <select
          name="tipo_servicio_id"
          value={tipoServicioId}
          onChange={(event) => onTipoServicioChange(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
          disabled={tiposServicioLoading}
        >
          <option value="">Seleccione una opción</option>
          {tiposServicio.map((tipo) => (
            <option key={tipo.ID ?? tipo.id} value={tipo.ID ?? tipo.id}>
              {tipo.NOMBRE ?? tipo.nombre}
            </option>
          ))}
        </select>
        {tiposServicioError && (
          <span className="text-xs text-red-600">{tiposServicioError}</span>
        )}
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="activo"
          checked={activo}
          onChange={(event) => onActivoChange(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
        />
        <span className="font-medium text-gray-700">Cliente activo</span>
      </label>
    </div>

    {formError && <p className="text-sm text-red-600">{formError}</p>}
  </>
);

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  const [clienteId, setClienteId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [tipoServicioId, setTipoServicioId] = useState("");
  const [tiposServicio, setTiposServicio] = useState([]);
  const [tiposServicioLoading, setTiposServicioLoading] = useState(false);
  const [tiposServicioError, setTiposServicioError] = useState("");
  const [activo, setActivo] = useState(true);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [personasAsignadas, setPersonasAsignadas] = useState([]);
  const [personasDisponibles, setPersonasDisponibles] = useState([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState("");
  const [personaSearch, setPersonaSearch] = useState("");
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState("");
  const [personaActionLoading, setPersonaActionLoading] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [clienteEnEdicion, setClienteEnEdicion] = useState(null);

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true);
      const searchTerm = search.trim();
      const data = await getAllClientes(
        searchTerm ? { q: searchTerm } : undefined
      );
      setClientes(data);
    } catch (error) {
      console.error("[ERROR] No se pudieron cargar los clientes:", error);
      const message = resolveErrorMessage(
        error,
        "No se pudieron cargar los clientes"
      );
      toast.error(message);
      setClientes([]); // Evita romper el renderizado
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    const loadTiposServicio = async () => {
      try {
        setTiposServicioLoading(true);
        setTiposServicioError("");
        const data = await getTiposServicio();
        setTiposServicio(Array.isArray(data) ? data : []);
      } catch (error) {
        const message = resolveErrorMessage(
          error,
          "No se pudieron cargar los tipos de servicio"
        );
        setTiposServicio([]);
        setTiposServicioError(message);
        toast.error(message);
      } finally {
        setTiposServicioLoading(false);
      }
    };

    loadTiposServicio();
  }, []);

  const limpiarFormulario = () => {
    setClienteId(null);
    setNombre("");
    setIdentificacion("");
    setTipoServicioId("");
    setActivo(true);
    setFormError("");
  };

  const cerrarModalEdicion = () => {
    setIsEditModalOpen(false);
    setClienteEnEdicion(null);
    limpiarFormulario();
  };

  const handleSort = (key) => {
    if (!key) {
      return;
    }

    const isSameKey = sortConfig?.key === key;
    const nextDirection = isSameKey && sortConfig?.direction === "asc" ? "desc" : "asc";

    setSortConfig({ key, direction: nextDirection });
  };

  const sortedClientes = useMemo(() => {
    if (!Array.isArray(clientes)) {
      return [];
    }

    if (!sortConfig) {
      return [...clientes];
    }

    const sorted = [...clientes];
    const { key, direction } = sortConfig;

    sorted.sort((a, b) => {
      const aValue = a?.[key];
      const bValue = b?.[key];

      if (key === "id") {
        const aNumber = Number(aValue) || 0;
        const bNumber = Number(bValue) || 0;
        return direction === "asc" ? aNumber - bNumber : bNumber - aNumber;
      }

      const aText = (aValue ?? "").toString().toLowerCase();
      const bText = (bValue ?? "").toString().toLowerCase();
      const comparison = aText.localeCompare(bText);

      return direction === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [clientes, sortConfig]);

  const handleExportToExcel = () => {
    if (loading || !Array.isArray(sortedClientes) || sortedClientes.length === 0) {
      return;
    }

    const formattedRows = sortedClientes.map((cliente) => ({
      ID: cliente.id ?? "—",
      Nombre: cliente.nombre ?? "—",
      Identificación: cliente.identificacion ?? "—",
      "Tipo de servicio": cliente.tipo_servicio_nombre ?? "—",
      Activo: cliente.activo ? "Sí" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");

    const filename = `mantenimiento_clientes_${formatTimestamp()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!nombre || !identificacion || !tipoServicioId) {
      setFormError("Nombre, identificación y tipo de servicio son obligatorios");
      return;
    }

    const tipoServicioIdNumber = Number(tipoServicioId);
    if (!Number.isInteger(tipoServicioIdNumber) || tipoServicioIdNumber <= 0) {
      setFormError("Seleccione un tipo de servicio válido");
      return;
    }

    const payload = {
      nombre,
      identificacion,
      tipo_servicio_id: tipoServicioIdNumber,
      activo,
    };

    try {
      setSubmitting(true);
      if (clienteId) {
        await updateCliente(clienteId, payload);
        toast.success("Cliente actualizado correctamente");
      } else {
        await createCliente(payload);
        toast.success("Cliente guardado correctamente");
      }
      await fetchClientes();
      setIsEditModalOpen(false);
      setClienteEnEdicion(null);
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
    setClienteEnEdicion(c);
    setClienteId(c.id);
    setNombre(c.nombre ?? "");
    setIdentificacion(c.identificacion ?? "");
    setTipoServicioId(
      c.tipo_servicio_id != null ? String(c.tipo_servicio_id) : ""
    );
    setActivo(Boolean(c.activo));
    setIsEditModalOpen(true);
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
      await api.delete(`/clientes/${id}`);
      toast.success("Cliente eliminado correctamente");
      await fetchClientes();
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudo eliminar el cliente");
      toast.error(message);
    }
  };

  const loadPersonasRelacionadas = useCallback(
    async (id) => {
      if (!id) {
        setPersonasAsignadas([]);
        setPersonasDisponibles([]);
        setPersonaSeleccionada("");
        setPersonaSearch("");
        setPersonasError("");
        return;
      }

      setPersonasLoading(true);
      setPersonasError("");
      try {
        const [asignadas, disponibles] = await Promise.all([
          getPersonasByCliente(id),
          getPersonasDisponiblesParaCliente(id),
        ]);
        setPersonasAsignadas(Array.isArray(asignadas) ? asignadas : []);
        setPersonasDisponibles(Array.isArray(disponibles) ? disponibles : []);
        setPersonaSeleccionada("");
      } catch (error) {
        const message = resolveErrorMessage(
          error,
          "No se pudieron cargar las personas relacionadas"
        );
        setPersonasAsignadas([]);
        setPersonasDisponibles([]);
        setPersonasError(message);
        toast.error(message);
      } finally {
        setPersonasLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (clienteId) {
      loadPersonasRelacionadas(clienteId);
    } else {
      loadPersonasRelacionadas(null);
    }
  }, [clienteId, loadPersonasRelacionadas]);

  const handleAgregarPersona = async () => {
    if (!clienteId || !personaSeleccionada) {
      return;
    }

    try {
      setPersonaActionLoading(true);
      await addPersonaToCliente(clienteId, Number(personaSeleccionada));
      toast.success("Persona asignada correctamente");
      setPersonaSeleccionada("");
      await loadPersonasRelacionadas(clienteId);
    } catch (error) {
      const message = resolveErrorMessage(
        error,
        "No se pudo asignar la persona al cliente"
      );
      toast.error(message);
    } finally {
      setPersonaActionLoading(false);
    }
  };

  const handleQuitarPersona = async (personaId, nombreCompleto) => {
    if (!clienteId) {
      return;
    }

    const confirmed = window.confirm(
      nombreCompleto
        ? `¿Deseas quitar a ${nombreCompleto} del cliente seleccionado?`
        : "¿Deseas quitar esta persona del cliente?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setPersonaActionLoading(true);
      await removePersonaFromCliente(clienteId, personaId);
      toast.success("Persona retirada del cliente");
      await loadPersonasRelacionadas(clienteId);
    } catch (error) {
      const message = resolveErrorMessage(
        error,
        "No se pudo quitar la persona del cliente"
      );
      toast.error(message);
    } finally {
      setPersonaActionLoading(false);
    }
  };

  const filteredPersonasDisponibles = useMemo(() => {
    const term = personaSearch.trim().toLowerCase();
    if (!term) {
      return personasDisponibles;
    }

    return personasDisponibles.filter((persona) => {
      const texto = `${persona.nombre ?? ""} ${persona.apellido ?? ""} ${
        persona.cargo_descripcion ?? ""
      }`;
      return texto.toLowerCase().includes(term);
    });
  }, [personaSearch, personasDisponibles]);

  const formatFechaAsignacion = (value) => {
    if (!value) {
      return "—";
    }
    try {
      return new Intl.DateTimeFormat("es-EC", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch (error) {
      console.warn("[CLIENTES] No se pudo formatear la fecha", error);
      return value;
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
          <button type="button" className={secondaryButtonClasses} onClick={cerrarModalEdicion}>
            Cancelar edición
          </button>
        )}
      </header>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">
          {clienteId !== null ? "Editar cliente" : "Registrar nuevo cliente"}
        </h2>
        <form className="space-y-4" onSubmit={handleSave}>
          <ClienteFormFields
            nombre={nombre}
            identificacion={identificacion}
            tipoServicioId={tipoServicioId}
            activo={activo}
            tiposServicio={tiposServicio}
            tiposServicioLoading={tiposServicioLoading}
            tiposServicioError={tiposServicioError}
            formError={formError}
            onNombreChange={setNombre}
            onIdentificacionChange={setIdentificacion}
            onTipoServicioChange={setTipoServicioId}
            onActivoChange={setActivo}
          />

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
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1C2E4A]">
              Personas asociadas al cliente
            </h2>
            <p className="text-sm text-gray-500">
              {clienteId
                ? "Gestiona las personas asignadas al cliente seleccionado"
                : "Selecciona un cliente existente para administrar sus personas"}
            </p>
          </div>
          {clienteId && (
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Buscar persona</span>
                <input
                  type="search"
                  value={personaSearch}
                  onChange={(event) => setPersonaSearch(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Filtrar por nombre o cargo"
                  disabled={personasLoading}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm md:w-64">
                <span className="font-medium text-gray-700">
                  Personas disponibles
                </span>
                <select
                  value={personaSeleccionada}
                  onChange={(event) => setPersonaSeleccionada(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  disabled={personasLoading || personaActionLoading}
                >
                  <option value="">Seleccione una persona</option>
                  {filteredPersonasDisponibles.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {`${persona.nombre ?? ""} ${persona.apellido ?? ""} ${
                        persona.cargo_descripcion
                          ? `- ${persona.cargo_descripcion}`
                          : ""
                      }`.trim()}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={primaryButtonClasses}
                disabled={
                  !clienteId ||
                  !personaSeleccionada ||
                  personasLoading ||
                  personaActionLoading
                }
                onClick={handleAgregarPersona}
              >
                {personaActionLoading ? "Procesando..." : "Agregar"}
              </button>
            </div>
          )}
        </div>

        {!clienteId && (
          <p className="text-sm text-gray-500">
            Debes seleccionar un cliente existente para poder asignar personas.
          </p>
        )}

        {personasError && (
          <p className="text-sm text-red-600">{personasError}</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Apellido
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cargo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha asignación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {personasLoading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-sm text-gray-500">
                    Cargando personas...
                  </td>
                </tr>
              ) : clienteId && personasAsignadas.length > 0 ? (
                personasAsignadas.map((persona) => (
                  <tr key={persona.persona_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {persona.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {persona.apellido ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {persona.cargo_descripcion ?? persona.cargo_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          Boolean(persona.estado)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {Boolean(persona.estado) ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatFechaAsignacion(persona.fecha_asignacion)}
                    </td>
                    <td className="px-4 py-3 text-sm sticky right-0 bg-white">
                      <button
                        type="button"
                        className={dangerButtonClasses}
                        disabled={personaActionLoading}
                        onClick={() =>
                          handleQuitarPersona(
                            persona.persona_id,
                            `${persona.nombre ?? ""} ${persona.apellido ?? ""}`.trim()
                          )
                        }
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-sm text-gray-500">
                    {clienteId
                      ? "No hay personas asignadas a este cliente"
                      : "Selecciona un cliente para ver sus personas"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Listado de clientes</h2>
            <p className="text-sm text-gray-500">
              {`Se encontraron ${clientes.length} cliente(s)`}
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <label className="flex w-full items-center gap-3 md:w-auto">
              <span className="text-sm font-medium text-gray-700">Buscar</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full md:w-64 rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                placeholder="Buscar por nombre, identificación o tipo de servicio"
              />
            </label>
            <button
              type="button"
              className={secondaryButtonClasses}
              onClick={handleExportToExcel}
              disabled={loading || sortedClientes.length === 0}
            >
              Exportar a Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none"
                  onClick={() => handleSort("id")}
                >
                  <span className="inline-flex items-center gap-1">
                    ID
                    {sortConfig?.key === "id" && (
                      <span aria-hidden>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none"
                  onClick={() => handleSort("nombre")}
                >
                  <span className="inline-flex items-center gap-1">
                    Nombre
                    {sortConfig?.key === "nombre" && (
                      <span aria-hidden>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none"
                  onClick={() => handleSort("identificacion")}
                >
                  <span className="inline-flex items-center gap-1">
                    Identificación
                    {sortConfig?.key === "identificacion" && (
                      <span aria-hidden>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none"
                  onClick={() => handleSort("tipo_servicio_nombre")}
                >
                  <span className="inline-flex items-center gap-1">
                    Tipo de servicio
                    {sortConfig?.key === "tipo_servicio_nombre" && (
                      <span aria-hidden>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none"
                  onClick={() => handleSort("activo")}
                >
                  <span className="inline-flex items-center gap-1">
                    Activo
                    {sortConfig?.key === "activo" && (
                      <span aria-hidden>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {Array.isArray(sortedClientes) && sortedClientes.length > 0 ? (
                sortedClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{cliente.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {cliente.nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cliente.identificacion || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cliente.tipo_servicio_nombre || "—"}
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
              ) : (
                <tr>
                  <td colSpan="6" className="text-center text-gray-500 py-4">
                    No hay clientes disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={cerrarModalEdicion}
        >
          <div
            className="relative w-full max-w-3xl rounded-lg bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1C2E4A]">
                  Editar cliente
                </h3>
                {clienteEnEdicion?.nombre && (
                  <p className="text-sm text-gray-500">{clienteEnEdicion.nombre}</p>
                )}
              </div>
              <button
                type="button"
                className="text-gray-500 transition-colors hover:text-gray-700"
                onClick={cerrarModalEdicion}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-6 py-4">
              <form className="space-y-4" onSubmit={handleSave}>
                <ClienteFormFields
                  nombre={nombre}
                  identificacion={identificacion}
                  tipoServicioId={tipoServicioId}
                  activo={activo}
                  tiposServicio={tiposServicio}
                  tiposServicioLoading={tiposServicioLoading}
                  tiposServicioError={tiposServicioError}
                  formError={formError}
                  onNombreChange={setNombre}
                  onIdentificacionChange={setIdentificacion}
                  onTipoServicioChange={setTipoServicioId}
                  onActivoChange={setActivo}
                />

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className={secondaryButtonClasses}
                    onClick={cerrarModalEdicion}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={primaryButtonClasses}
                    disabled={submitting}
                  >
                    {submitting ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
