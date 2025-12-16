const candidateKeys = ['usuario', 'user', 'session', 'SW_SESSION'];

const parseUserIdValue = (value: unknown): number | null => {
  const candidates = [
    (value as { usuario_id?: unknown })?.usuario_id,
    (value as { user_id?: unknown })?.user_id,
    (value as { usuarioId?: unknown })?.usuarioId,
    (value as { userId?: unknown })?.userId,
    (value as { id?: unknown })?.id,
    (value as { usuario?: { id?: unknown; usuario_id?: unknown } }).usuario?.id,
    (value as { usuario?: { id?: unknown; usuario_id?: unknown } }).usuario?.usuario_id,
    (value as { user?: { id?: unknown; user_id?: unknown } }).user?.id,
    (value as { user?: { id?: unknown; user_id?: unknown } }).user?.user_id,
    (value as { data?: { id?: unknown; usuario_id?: unknown } }).data?.id,
    (value as { data?: { id?: unknown; usuario_id?: unknown } }).data?.usuario_id,
    (value as { sub?: unknown }).sub,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const decodeJwtPayload = (token: string): unknown => {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
};

const parseUserIdFromToken = (token: string | null): number | null => {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return parseUserIdValue(payload);
};

export const getCurrentUserIdFromStorage = (): number | null => {
  for (const key of candidateKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const possibleSources = [parsed, (parsed as { user?: unknown }).user, (parsed as { usuario?: unknown }).usuario, (parsed as { session?: unknown }).session];

      for (const source of possibleSources) {
        const userId = parseUserIdValue(source);
        if (userId) {
          return userId;
        }
      }
    } catch (_error) {
      // Ignore parse errors and continue with other sources
    }
  }

  const fallbackTokenId = parseUserIdFromToken(localStorage.getItem('token'));
  if (fallbackTokenId) {
    return fallbackTokenId;
  }

  return null;
};

export default getCurrentUserIdFromStorage;
