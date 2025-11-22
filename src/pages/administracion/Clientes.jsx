import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { getAllClientes } from "@/services/clientes.service";
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

  const [clienteId, setClienteId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [telefono, setTelefono] = useState("");
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

  const fetchClientes = useCallback(async () => {
    try {
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
    }
  }, [search]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const limpiarFormulario = () => {
    setClienteId(null);
    setNombre("");
    setIdentificacion("");
    setTelefono("");
    setActivo(true);
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
    };

    try {
      setSubmitting(true);
      if (clienteId) {
        await api.put(`/clientes/${clienteId}`, payload);
        toast.success("Cliente actualizado correctamente");
      } else {
        await api.post(`/clientes`, payload);
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
              {Array.isArray(clientes) && clientes.length > 0 ? (
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
    </div>
  );
};

export default Clientes;
