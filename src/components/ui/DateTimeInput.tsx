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
  onChange: (
    value: string | null,
    helpers: { isoString: string | null; dateValue: Date | null },
  ) => void;
}

const DateTimeInput: React.FC<DateTimeInputProps> = ({
  label,
  value,
  onChange,
  id,
  name,
  className = '',
  ...inputProps
}) => {
  const normalizedValue = normalizeDateTimeLocalString(value);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value || null;
    const parsedDate = newValue ? new Date(newValue) : null;
    const isoString = parsedDate && !Number.isNaN(parsedDate.getTime()) ? toIsoString(newValue) : null;
    onChange(newValue, { isoString, dateValue: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null });
  };

  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        id={id}
        name={name}
        type="datetime-local"
        value={normalizedValue}
        onChange={handleChange}
        placeholder="mm/dd/yyyy --:--"
        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm ${className}`.trim()}
        {...inputProps}
      />
    </label>
  );
};

export default DateTimeInput;
