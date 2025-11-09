// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";

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
  warning: (message) => {
    if (typeof window !== "undefined") {
      window.alert(message);
    }
    console.warn(message);
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

const tableHeaderClasses = "bg-gray-100 text-left";
const cellClasses = "p-2";
const buttonBaseClasses =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
const primaryButtonClasses = `${buttonBaseClasses} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;

const AsignarClienteSitio = () => {
  const [sitios, setSitios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selecciones, setSelecciones] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingState, setSavingState] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  const clientesActivos = useMemo(
    () => clientes.filter((cliente) => cliente && cliente.activo !== false),
    [clientes]
  );

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [sitiosResponse, clientesResponse] = await Promise.all([
        api.get("/api/asignar-cliente-sitio"),
        api.get("/api/clientes"),
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

  const handleSelectionChange = (sitioId, value) => {
    setSelecciones((prev) => ({
      ...prev,
      [sitioId]: value,
    }));
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
      await api.post("/api/asignar-cliente-sitio", {
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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-3">Asignar Clientes a Sitios</h2>

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Cargando información...</p>
      ) : sitios.length === 0 ? (
        <p className="text-sm text-gray-600">No hay sitios disponibles.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto w-full border">
            <thead>
              <tr className={tableHeaderClasses}>
                <th className={cellClasses}>Sitio</th>
                <th className={cellClasses}>Cliente actual</th>
                <th className={cellClasses}>Asignar nuevo cliente</th>
                <th className={cellClasses}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sitios.map((sitio) => {
                const isSaving = Boolean(savingState[sitio.sitio_id]);
                const selectedValue = selecciones[sitio.sitio_id] ?? "";

                return (
                  <tr key={sitio.sitio_id} className="border-t">
                    <td className={cellClasses}>{sitio.sitio_nombre}</td>
                    <td className={cellClasses}>{sitio.cliente_nombre || "Sin asignar"}</td>
                    <td className={cellClasses}>
                      <select
                        value={selectedValue}
                        onChange={(event) => handleSelectionChange(sitio.sitio_id, event.target.value)}
                        className="border rounded p-1 w-full"
                      >
                        <option value="">Seleccione cliente</option>
                        {clientesActivos.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cellClasses}>
                      <button
                        type="button"
                        className={primaryButtonClasses}
                        onClick={() => guardar(sitio.sitio_id)}
                        disabled={isSaving}
                      >
                        {isSaving ? "Guardando..." : "Guardar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AsignarClienteSitio;
