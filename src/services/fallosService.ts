import api from "@/api";

export const getFallos = async () => {
  const res = await api.get("/api/fallos");
  if (!res.ok) throw new Error("Error al obtener los fallos técnicos");
  return res.data;
};

export const createFallo = async (payload: any) => {
  const res = await api.post("/api/fallos", payload);
  if (!res.ok) throw new Error("Error al registrar el fallo técnico");
  return res.data;
};

export const updateFallo = async (id: number | string, payload: any) => {
  const res = await api.put(`/api/fallos/${id}`, payload);
  if (!res.ok) throw new Error("Error al actualizar el fallo técnico");
  return res.data;
};

export default {
  getFallos,
  createFallo,
  updateFallo,
};
