import React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

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

export const buildDateTimeLocalValue = (date?: string, time?: string) => {
  if (!date) return '';
  const sanitizedTime = (time ?? '00:00').slice(0, 5);
  return `${date}T${sanitizedTime}`;
};

export const toDayjsSafe = (value: unknown): Dayjs | null => {
  if (!value) return null;

  if (dayjs.isDayjs(value)) return value as Dayjs;

  if (value instanceof Date) {
    const d = dayjs(value);
    return d.isValid() ? d : null;
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    let d = dayjs(raw);
    if (d.isValid()) return d;

    d = dayjs(raw, DATE_TIME_FORMATS, true);
    if (d.isValid()) return d;

    d = dayjs(raw, ["MM/DD/YYYY hh:mm A", "M/D/YYYY hh:mm A"], true);
    if (d.isValid()) return d;

    d = dayjs(raw.replace(' ', 'T'));
    if (d.isValid()) return d;

    return null;
  }

  return null;
};

export const parseLocalDateTime = (value?: unknown): Dayjs | null => toDayjsSafe(value);

export const normalizeDateTimeLocalString = (value?: string | null) => {
  const parsed = parseLocalDateTime(value);
  return parsed ? parsed.format("YYYY-MM-DD'T'HH:mm") : '';
};

export const splitDateTimeLocalValue = (value?: string | null): DateTimeParts => {
  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    return { date: undefined, time: undefined };
  }

  return {
    date: parsed.format('YYYY-MM-DD'),
    time: parsed.format('HH:mm'),
  };
};

export const toIsoString = (value?: string | null) => {
  const parsed = parseLocalDateTime(value);
  return parsed ? parsed.format('YYYY-MM-DD HH:mm:ss') : null;
};

interface DateTimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  value?: string | null;
  error?: string;
  onChange: (
    value: string | null,
    helpers: { isoString: string | null; dateValue: Dayjs | null },
  ) => void;
}

const DateTimeInput: React.FC<DateTimeInputProps> = ({
  label,
  value,
  error,
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

    const parsed = parseLocalDateTime(value);
    return parsed ? parsed.format("YYYY-MM-DD'T'HH:mm") : '';
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value || null;
    const parsedDate = parseLocalDateTime(newValue);
    const isoString = parsedDate ? toIsoString(newValue) : null;
    onChange(newValue, {
      isoString,
      dateValue: parsedDate,
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
