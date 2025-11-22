// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { Save, ChevronDown, Loader2 } from "lucide-react";

// Simple toast replacement since we don't have an external library
// and we want to avoid errors.
const toast = {
  success: (message) => {
    if (typeof window !== "undefined") {
      // In a real app you might use a toast library.
      // For now, simple alert or console log is safer than crashing.
      console.log("Success:", message);
      // We can try to create a temporary DOM element for feedback if needed,
      // but for now let's just log it.
    }
  },
  error: (message) => {
    if (typeof window !== "undefined") {
      console.error("Error:", message);
    }
  },
  warning: (message) => {
    if (typeof window !== "undefined") {
      console.warn("Warning:", message);
    }
  },
};

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.data?.data)) {
    return value.data.data;
  }

  return [];
};

const normalizeId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const resolveErrorMessage = (error, fallbackMessage) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error.trim();
  }

  return fallbackMessage;
};

const ITEMS_PER_PAGE = 10;

// Styles
const baseButtonClasses =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2";
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;

const AsignarClienteSitio = () => {
  const [sitios, setSitios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selecciones, setSelecciones] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingState, setSavingState] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const clientesActivos = useMemo(
    () => clientes.filter((cliente) => cliente && cliente.activo !== false),
    [clientes]
  );

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [sitiosResponse, clientesResponse] = await Promise.all([
        api.get("/asignar-cliente-sitio"),
        api.get("/clientes"),
      ]);

      const sitiosData = ensureArray(sitiosResponse?.data ?? sitiosResponse);
      const clientesData = ensureArray(clientesResponse?.data ?? clientesResponse);

      const sitiosNormalizados = Array.isArray(sitiosData)
        ? sitiosData
            .filter((item) => normalizeId(item?.sitio_id) !== null)
            .map((item) => ({
              sitio_id: normalizeId(item.sitio_id),
              sitio_nombre: item.sitio_nombre ?? "Sitio sin nombre",
              cliente_id: normalizeId(item.cliente_id),
              cliente_nombre: item.cliente_nombre ?? null,
            }))
        : [];

      setSitios(sitiosNormalizados);
      setClientes(Array.isArray(clientesData) ? clientesData : []);

      const valoresIniciales = sitiosNormalizados.reduce((acc, sitio) => {
        if (sitio.cliente_id) {
          acc[sitio.sitio_id] = String(sitio.cliente_id);
        }
        return acc;
      }, {});
      setSelecciones(valoresIniciales);
    } catch (error) {
      const message = resolveErrorMessage(error, "No se pudieron cargar los sitios y clientes");
      setSitios([]);
      setClientes([]);
      setSelecciones({});
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const filteredSitios = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return sitios;
    }
    return sitios.filter((sitio) =>
      [sitio.sitio_nombre, sitio.cliente_nombre].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [sitios, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredSitios.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, filteredSitios.length]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSitios.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSitios, currentPage]);

  const handleSelectionChange = (sitioId, value) => {
    setSelecciones((prev) => ({
      ...prev,
      [sitioId]: value,
    }));
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const guardar = async (sitioId) => {
    const clienteSeleccionado = selecciones[sitioId];
    const clienteId = normalizeId(clienteSeleccionado);

    if (!clienteId) {
      toast.warning("Seleccione un cliente válido");
      return;
    }

    setSavingState((prev) => ({ ...prev, [sitioId]: true }));

    try {
      await api.post("/asignar-cliente-sitio", {
        sitio_id: sitioId,
        cliente_id: clienteId,
      });
      toast.success("Cliente asignado correctamente");
      await cargarDatos();
    } catch (error) {
      const message = resolveErrorMessage(error, "Error al asignar cliente al sitio");
      toast.error(message);
    } finally {
      setSavingState((prev) => {
        const next = { ...prev };
        delete next[sitioId];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Asignar Clientes a Sitios</h1>
          <p className="text-sm text-gray-500">
            Gestione la asignación de clientes a los sitios registrados.
          </p>
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
              placeholder="Buscar por sitio o cliente actual..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
        </div>

        {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
            </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Cargando información...</p>
        ) : filteredSitios.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron registros.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#1C2E4A]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      SITIO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      CLIENTE ACTUAL
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      ASIGNAR NUEVO CLIENTE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {currentItems.map((sitio) => {
                    const isSaving = Boolean(savingState[sitio.sitio_id]);
                    const selectedValue = selecciones[sitio.sitio_id] ?? "";

                    return (
                      <tr key={sitio.sitio_id}>
                        <td className="px-4 py-5 text-sm text-gray-700">{sitio.sitio_nombre}</td>
                        <td className="px-4 py-5 text-sm text-gray-700">{sitio.cliente_nombre || "Sin asignar"}</td>
                        <td className="px-4 py-5 text-sm text-gray-700">
                          <div className="relative">
                            <select
                                value={selectedValue}
                                onChange={(event) => handleSelectionChange(sitio.sitio_id, event.target.value)}
                                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-blue-500 transition-colors"
                            >
                                <option value="">Seleccione cliente</option>
                                {clientesActivos.map((cliente) => (
                                <option key={cliente.id} value={cliente.id}>
                                    {cliente.nombre}
                                </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <ChevronDown size={16} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm text-gray-700">
                            <button
                                type="button"
                                onClick={() => guardar(sitio.sitio_id)}
                                disabled={isSaving}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-full transition-colors disabled:opacity-50"
                                title="Guardar asignación"
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            </button>
                        </td>
                      </tr>
                    );
                  })}
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
    </div>
  );
};

export default AsignarClienteSitio;
