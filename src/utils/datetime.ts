const LOCAL_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
const ISO_WITH_TZ_REGEX = /([zZ]|[+-]\d{2}:\d{2})$/;

export const parseDbTimestampToLocal = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (ISO_WITH_TZ_REGEX.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (LOCAL_TIMESTAMP_REGEX.test(raw)) {
    const normalized = raw.replace(' ', 'T');
    const [datePart, timePart = '00:00:00'] = normalized.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second = 0] = timePart.split(':').map(Number);
    const parsed = new Date(year, month - 1, day, hour, minute, Number(second), 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatTwoDigits = (value: number) => String(value).padStart(2, '0');

export const formatLocalDateTime = (value?: string | Date | null): string => {
  const parsed = parseDbTimestampToLocal(value);
  if (!parsed) {
    if (typeof value === 'string') {
      return value.replace('T', ' ').replace('Z', '');
    }
    return '';
  }

  const year = parsed.getFullYear();
  const month = formatTwoDigits(parsed.getMonth() + 1);
  const day = formatTwoDigits(parsed.getDate());
  const hours = formatTwoDigits(parsed.getHours());
  const minutes = formatTwoDigits(parsed.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export const formatLocalDateTimeInput = (value?: string | Date | null): string => {
  const parsed = parseDbTimestampToLocal(value);
  if (!parsed) return '';

  const year = parsed.getFullYear();
  const month = formatTwoDigits(parsed.getMonth() + 1);
  const day = formatTwoDigits(parsed.getDate());
  const hours = formatTwoDigits(parsed.getHours());
  const minutes = formatTwoDigits(parsed.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
