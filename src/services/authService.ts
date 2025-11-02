export interface LoginResponse {
  message: string;
  token: string;
  usuario: { id: number; nombre_usuario: string; roles: string[] };
  consolas: { id: number; nombre: string }[];
}

export async function login(nombre_usuario: string, contrasena_plana: string) {
  const resp = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre_usuario, contrasena_plana }),
  });

  let data: any = null;
  try {
    data = await resp.json();
  } catch (error) {
    data = null;
  }

  if (!resp.ok) {
    const msg = data?.message || `Error de autenticación (${resp.status})`;
    const error = new Error(msg) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }

  return data as LoginResponse;
}
