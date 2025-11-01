import React, { useEffect, useMemo, useState } from 'react';
import DatePicker, {
  ReactDatePickerCustomHeaderProps,
  registerLocale,
} from 'react-datepicker';
import { es } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/datepicker.css';

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

registerLocale('es', es);

const toIsoLocalString = (value: Date): string => {
  const normalized = new Date(value);
  normalized.setSeconds(0, 0);

  const year = normalized.getFullYear();
  const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
  const day = `${normalized.getDate()}`.padStart(2, '0');
  const hours = `${normalized.getHours()}`.padStart(2, '0');
  const minutes = `${normalized.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const CalendarHeader: React.FC<ReactDatePickerCustomHeaderProps> = ({
  date,
  decreaseMonth,
  increaseMonth,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
}) => {
  return (
    <div className="flex items-center justify-between px-2 pb-2">
      <button
        type="button"
        onClick={decreaseMonth}
        disabled={prevMonthButtonDisabled}
        className="p-1 rounded-full text-[#1C2E4A] transition-colors hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent"
        aria-label="Mes anterior"
      >
        <svg
          className="w-5 h-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <p className="text-sm font-semibold text-[#1C2E4A] capitalize">
        {new Intl.DateTimeFormat('es-MX', {
          month: 'long',
          year: 'numeric',
        }).format(date)}
      </p>
      <button
        type="button"
        onClick={increaseMonth}
        disabled={nextMonthButtonDisabled}
        className="p-1 rounded-full text-[#1C2E4A] transition-colors hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent"
        aria-label="Mes siguiente"
      >
        <svg
          className="w-5 h-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setSelectedDate(parsedValue);
  }, [parsedValue]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      setSelectedDate(null);
      onChange('');
      return;
    }

    const normalized = new Date(date);
    normalized.setSeconds(0, 0);

    setSelectedDate(normalized);
    onChange(toIsoLocalString(normalized));
  };

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
          timeCaption="Hora"
          dateFormat="dd/MM/yyyy HH:mm"
          placeholderText={placeholder}
          locale="es"
          required={required}
          wrapperClassName="w-full"
          className={`w-full border ${
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-[#F9C300] focus:ring-[#F9C300]'
          } rounded-lg bg-white px-3 py-2 pr-11 text-sm text-[#1C2E4A] shadow-sm focus:outline-none focus:ring-2`}
          calendarClassName="fecha-hora-calendar"
          popperClassName="fecha-hora-popper"
          popperPlacement="bottom-start"
          showPopperArrow={false}
          withPortal={isMobile}
          renderCustomHeader={(headerProps: ReactDatePickerCustomHeaderProps) => (
            <CalendarHeader {...headerProps} />
          )}
          autoComplete="off"
        />
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -mt-2 h-5 w-5 text-[#1C2E4A]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      {selectedDate && (
        <button
          type="button"
          onClick={() => handleDateChange(null)}
          className="mt-2 text-xs font-medium text-gray-500 underline"
        >
          Limpiar selección
        </button>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default FechaHoraFalloPicker;
