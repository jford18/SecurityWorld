import React, { useEffect, useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import { isAfter, isSameDay, startOfDay } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

interface FechaHoraFalloPickerProps {
  id: string;
  name: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

const toast = {
  error: (message: string) => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-alert
      window.alert(message);
    }
    // eslint-disable-next-line no-console
    console.error(message);
  },
};

registerLocale('es', es);

const clampToEndOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const FechaHoraFalloPicker: React.FC<FechaHoraFalloPickerProps> = ({
  id,
  name,
  label = 'Fecha y Hora del Fallo *',
  value,
  onChange,
  placeholder = 'Seleccione fecha y hora',
  required,
  error,
}) => {
  const parsedValue = useMemo(() => {
    if (!value) {
      return null;
    }
    const candidate = new Date(value);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }, [value]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedValue);

  useEffect(() => {
    setSelectedDate(parsedValue);
  }, [parsedValue]);

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      setSelectedDate(null);
      onChange('');
      return;
    }

    const now = new Date();
    if (isAfter(date, now)) {
      toast.error('No puedes seleccionar una fecha futura');
      return;
    }

    setSelectedDate(date);
    onChange(date.toISOString());
  };

  const now = new Date();
  const startOfToday = startOfDay(now);

  const isSelectedToday = selectedDate ? isSameDay(selectedDate, now) : true;

  const minTime = isSelectedToday
    ? startOfToday
    : startOfDay(selectedDate ?? now);

  const maxTime = isSelectedToday
    ? now
    : clampToEndOfDay(selectedDate ?? now);

  return (
    <div className="md:col-span-2">
      <label htmlFor={id} className="block text-sm font-medium text-[#1C2E4A]">
        {label}
      </label>
      <div className="mt-1 relative">
        <DatePicker
          id={id}
          name={name}
          selected={selectedDate}
          onChange={handleDateChange}
          showTimeSelect
          timeIntervals={5}
          timeFormat="HH:mm"
          dateFormat="dd/MM/yyyy, HH:mm"
          locale="es"
          maxDate={now}
          minTime={minTime}
          maxTime={maxTime}
          placeholderText={placeholder}
          className="w-full rounded-md border border-yellow-400 px-3 py-2 text-sm text-[#1C2E4A] placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
          calendarClassName="!text-xs !p-2 !shadow-lg !border !border-gray-200 !rounded-lg !w-64"
          popperClassName="z-50 !min-w-0"
          popperPlacement="bottom-start"
          dayClassName={() =>
            'text-xs !w-8 !h-8 flex items-center justify-center rounded-full hover:bg-yellow-100 focus:bg-yellow-100'
          }
          timeClassName={() => 'text-xs py-1'}
          wrapperClassName="w-full"
          shouldCloseOnSelect={false}
          required={required}
          autoComplete="off"
        />
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1C2E4A]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default FechaHoraFalloPicker;
