import React from 'react';
import dayjs, { Dayjs } from 'dayjs';

export type DateTimeParts = {
  date?: string;
  time?: string;
};

const DATE_TIME_FORMATS = [
  "YYYY-MM-DD'T'HH:mm:ss.SSS",
  "YYYY-MM-DD'T'HH:mm:ss",
  "YYYY-MM-DD'T'HH:mm",
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
];

const pad2 = (value: number) => String(value).padStart(2, '0');

export const parseLocalYMDHMS = (value?: string | Date | null): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    const copy = new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      0,
    );
    return Number.isNaN(copy.getTime()) ? null : copy;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const sanitized = trimmed.endsWith('Z') ? trimmed.slice(0, -1) : trimmed;

  const match = sanitized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);

  const parsed = new Date(year, month, day, hours, minutes, seconds, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatLocalYMDHMS = (value?: Date | null): string | null => {
  if (!value) return null;
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  const seconds = pad2(value.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const formatInputLocalValue = (value?: Date | null) => {
  if (!value) return '';
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const buildDateTimeLocalValue = (date?: string, time?: string) => {
  if (!date) return '';
  const sanitizedTime = (time ?? '00:00').slice(0, 5);
  return `${date}T${sanitizedTime}`;
};

export const toDayjsSafe = (value: unknown): Dayjs | null => {
  if (!value) return null;

  if (dayjs.isDayjs(value)) return value as Dayjs;

  const parsedDate = parseLocalYMDHMS(value as string | Date | null);
  if (parsedDate) {
    const d = dayjs(parsedDate);
    return d.isValid() ? d : null;
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    let d = dayjs(raw, DATE_TIME_FORMATS, true);
    if (d.isValid()) return d;

    d = dayjs(raw.replace(' ', 'T'));
    if (d.isValid()) return d;
  }

  return null;
};

export const parseLocalDateTime = (value?: unknown): Dayjs | null => toDayjsSafe(value);

export const normalizeDateTimeLocalString = (value?: string | null) => {
  const parsed = parseLocalYMDHMS(value);
  return parsed ? formatInputLocalValue(parsed) : '';
};

export const splitDateTimeLocalValue = (value?: string | null): DateTimeParts => {
  const parsed = parseLocalYMDHMS(value);
  if (!parsed) {
    return { date: undefined, time: undefined };
  }

  return {
    date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
    time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
  };
};

export const toIsoString = (value?: string | null) => {
  const parsed = parseLocalYMDHMS(value);
  return formatLocalYMDHMS(parsed);
};

type BaseDateTimeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  label?: string;
  error?: string;
  valueAsDate?: boolean;
};

type DateValueProps = {
  valueAsDate?: true;
  value?: Date | null;
  onChange: (
    value: Date | null,
    helpers: {
      isoString: string | null;
      dateValue: Dayjs | null;
      parsedDate?: Date | null;
    },
  ) => void;
};

type StringValueProps = {
  valueAsDate?: false;
  value?: string | null;
  onChange: (
    value: string | null,
    helpers: {
      isoString: string | null;
      dateValue: Dayjs | null;
      parsedDate?: Date | null;
    },
  ) => void;
};

type DateTimeInputProps = BaseDateTimeInputProps & (DateValueProps | StringValueProps);

const DateTimeInput: React.FC<DateTimeInputProps> = ({
  label,
  value,
  error,
  valueAsDate = false,
  onChange,
  id,
  name,
  className = '',
  readOnly = false,
  disabled = false,
  ...inputProps
}) => {
  const normalizedValue = React.useMemo(() => {
    if (!value) return '';

    const parsed = parseLocalYMDHMS(value as string | Date | null);
    return formatInputLocalValue(parsed);
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value || null;
    const parsedDate = parseLocalYMDHMS(rawValue);
    const isoString = formatLocalYMDHMS(parsedDate);
    const dayjsValue = parsedDate ? toDayjsSafe(parsedDate) : toDayjsSafe(rawValue ?? undefined);

    if (valueAsDate) {
      (onChange as DateValueProps['onChange'])(parsedDate, {
        isoString,
        dateValue: dayjsValue,
        parsedDate,
      });
      return;
    }

    (onChange as StringValueProps['onChange'])(rawValue, {
      isoString,
      dateValue: dayjsValue,
      parsedDate,
    });
  };

  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div className="relative mt-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 7.5v11.25a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V7.5m-15 0V6a1.5 1.5 0 011.5-1.5h12A1.5 1.5 0 0119.5 6v1.5M8.25 12h7.5M8.25 15.75h4.5"
            />
          </svg>
        </span>
        <input
          id={id}
          name={name}
          type="datetime-local"
          value={normalizedValue}
          onChange={handleChange}
          placeholder="mm/dd/yyyy --:--"
          className={`block w-full rounded-md border-gray-300 pl-10 pr-3 py-2 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm ${className}`.trim()}
          aria-invalid={Boolean(error)}
          readOnly={readOnly}
          disabled={disabled}
          {...inputProps}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  );
};

export default DateTimeInput;
