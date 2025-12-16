import React from 'react';

export type DateTimeParts = {
  date?: string;
  time?: string;
};

export const buildDateTimeLocalValue = (date?: string, time?: string) => {
  if (!date) return '';
  const sanitizedTime = (time ?? '00:00').slice(0, 5);
  return `${date}T${sanitizedTime}`;
};

export const normalizeDateTimeLocalString = (value?: string | null) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const withOffset = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return withOffset.toISOString().slice(0, 16);
};

export const splitDateTimeLocalValue = (value?: string | null): DateTimeParts => {
  const normalizedValue = normalizeDateTimeLocalString(value);
  if (!normalizedValue) {
    return { date: undefined, time: undefined };
  }
  const [datePart, timePartRaw] = normalizedValue.split('T');
  const timePart = timePartRaw ? timePartRaw.slice(0, 5) : undefined;
  return { date: datePart || undefined, time: timePart || undefined };
};

export const toIsoString = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const utcDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return utcDate.toISOString();
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
    const parsedDate = newValue ? new Date(newValue) : null;
    const isoString = parsedDate && !Number.isNaN(parsedDate.getTime()) ? toIsoString(newValue) : null;
    onChange(newValue, { isoString, dateValue: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null });
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
