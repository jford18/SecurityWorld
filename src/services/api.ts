// NEW: Punto único para obtener la URL base del backend y reutilizarla en los servicios.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
