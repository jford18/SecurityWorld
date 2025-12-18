import React from 'react';
import { format as formatDate, isValid, parse } from 'date-fns';

export type DateTimeParts = {
  date?: string;
  time?: string;
};

const DATE_TIME_FORMATS = [
  "yyyy-MM-dd'T'HH:mm:ss.SSS",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm",
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
];

export const buildDateTimeLocalValue = (date?: string, time?: string) => {
  if (!date) return '';
  const sanitizedTime = (time ?? '00:00').slice(0, 5);
  return `${date}T${sanitizedTime}`;
};

export const parseLocalDateTime = (value?: string | null): Date | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const cleanedValue = trimmed.endsWith('Z') ? trimmed.slice(0, -1) : trimmed;

  for (const format of DATE_TIME_FORMATS) {
    const parsedValue = parse(cleanedValue, format, new Date());
    if (isValid(parsedValue)) {
      return parsedValue;
    }
  }

  const fallback = new Date(cleanedValue);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const normalizeDateTimeLocalString = (value?: string | null) => {
  const parsed = parseLocalDateTime(value);
  return parsed ? formatDate(parsed, "yyyy-MM-dd'T'HH:mm") : '';
};

export const splitDateTimeLocalValue = (value?: string | null): DateTimeParts => {
  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    return { date: undefined, time: undefined };
  }

  return {
    date: formatDate(parsed, 'yyyy-MM-dd'),
    time: formatDate(parsed, 'HH:mm'),
  };
};

export const toIsoString = (value?: string | null) => {
  const parsed = parseLocalDateTime(value);
  return parsed ? formatDate(parsed, 'yyyy-MM-dd HH:mm:ss') : null;
};

interface DateTimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  value?: string | null;
  error?: string;
  onChange: (
    value: string | null,
    helpers: { isoString: string | null; dateValue: Date | null },
  ) => void;
}

const isDateTimeLocalFormat = (val: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val);

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

    if (isDateTimeLocalFormat(value)) {
      return value;
    }

    return normalizeDateTimeLocalString(value);
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
