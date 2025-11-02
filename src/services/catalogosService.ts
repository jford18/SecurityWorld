import api from "@/api";

export const getCatalogos = async () => {
  const [
    nodos,
    clientes,
    tiposEquipo,
    tiposProblema,
    departamentos,
    responsables,
    dispositivos,
    sitios,
  ] = await Promise.all([
    api.get("/api/nodos"),
    api.get("/api/clientes"),
    api.get("/api/catalogos/tipos-equipo"),
    api.get("/api/catalogos/tipos-problema"),
    api.get("/api/catalogos/departamentos"),
    api.get("/api/catalogos/responsables"),
    api.get("/api/dispositivos"),
    api.get("/api/sitios"),
  ]);

  return {
    nodos: nodos.data,
    clientes: clientes.data,
    tiposEquipo: tiposEquipo.data,
    tiposProblema: tiposProblema.data,
    departamentos: departamentos.data,
    responsables: responsables.data,
    dispositivos: dispositivos.data,
    sitios: sitios.data,
  };
};

export default {
  getCatalogos,
};
