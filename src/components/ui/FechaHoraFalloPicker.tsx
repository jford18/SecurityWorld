import React, { useEffect, useMemo, useRef, useState } from 'react';

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

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const isSameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const buildMonthMatrix = (reference: Date) => {
  // NEW: Genera una matriz de 6x7 para representar el calendario mensual.
  const firstDayOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const offset = (firstDayOfMonth.getDay() + 6) % 7;
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() - offset);

  const days: { date: Date; inCurrentMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push({
      date: day,
      inCurrentMonth: day.getMonth() === reference.getMonth(),
    });
  }

  return days;
};

const getDisplayValue = (value: Date | null) => {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
};

const sanitizeIsoString = (value: Date | null) => {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }
  return value.toISOString();
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
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => parsedValue || new Date());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // FIX: Sincroniza el valor controlado con el estado interno cuando proviene del formulario.
    setSelectedDate(parsedValue);
    if (parsedValue) {
      setVisibleMonth(parsedValue);
    }
  }, [parsedValue]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const days = useMemo(() => buildMonthMatrix(visibleMonth), [visibleMonth]);
  const displayValue = getDisplayValue(selectedDate);

  const handleDaySelection = (day: Date) => {
    const baseDate = new Date(day);
    const reference = selectedDate || new Date();
    baseDate.setHours(reference.getHours(), reference.getMinutes(), 0, 0);

    setSelectedDate(baseDate);
    onChange(sanitizeIsoString(baseDate));
    setVisibleMonth(baseDate);
  };

  const handleHourChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const hour = Number(event.target.value);
    const fallback = selectedDate || new Date();
    const reference = new Date(fallback);
    reference.setHours(hour, reference.getMinutes(), 0, 0);
    setSelectedDate(reference);
    onChange(sanitizeIsoString(reference));
    setVisibleMonth(reference);
  };

  const handleMinuteChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const minute = Number(event.target.value);
    const fallback = selectedDate || new Date();
    const reference = new Date(fallback);
    reference.setMinutes(minute, 0, 0);
    setSelectedDate(reference);
    onChange(sanitizeIsoString(reference));
    setVisibleMonth(reference);
  };

  const handleClear = () => {
    setSelectedDate(null);
    onChange('');
  };

  const hourValue = selectedDate ? selectedDate.getHours().toString().padStart(2, '0') : '';
  const minuteValue = selectedDate ? selectedDate.getMinutes().toString().padStart(2, '0') : '';

  return (
    <div ref={containerRef} className="md:col-span-2 relative">
      <label htmlFor={id} className="block text-sm font-medium text-[#1C2E4A]">
        {label}
      </label>
      <button
        id={id}
        name={name}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`mt-1 w-full flex items-center justify-between border rounded-lg px-3 py-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#F9C300] ${
          isOpen ? 'border-[#F9C300]' : 'border-gray-300'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-required={required}
      >
        <span className={`text-sm ${displayValue ? 'text-gray-900' : 'text-gray-400'}`}>
          {displayValue || placeholder}
        </span>
        <svg
          className="w-5 h-5 text-[#1C2E4A]"
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
      </button>
      {isOpen && (
        <div className="mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30 absolute left-0 right-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="p-1 rounded-full hover:bg-gray-100"
              onClick={() =>
                setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              aria-label="Mes anterior"
            >
              <svg
                className="w-5 h-5 text-[#1C2E4A]"
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
              }).format(visibleMonth)}
            </p>
            <button
              type="button"
              className="p-1 rounded-full hover:bg-gray-100"
              onClick={() =>
                setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              aria-label="Mes siguiente"
            >
              <svg
                className="w-5 h-5 text-[#1C2E4A]"
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

          <div className="mt-4 grid grid-cols-7 gap-1 text-xs text-center text-gray-500">
            {WEEK_DAYS.map((day) => (
              <span key={day} className="font-medium">
                {day}
              </span>
            ))}
            {days.map(({ date, inCurrentMonth }) => {
              const today = isSameDay(date, new Date());
              const selected = selectedDate ? isSameDay(date, selectedDate) : false;

              let buttonClass = 'w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors';
              if (selected) {
                buttonClass += ' bg-[#F9C300] text-[#1C2E4A] font-semibold shadow-inner';
              } else if (today) {
                buttonClass += ' border border-[#F9C300] text-[#1C2E4A]';
              } else {
                buttonClass += ' text-gray-700 hover:bg-gray-100';
              }

              if (!inCurrentMonth) {
                buttonClass += ' text-gray-400 hover:bg-gray-100';
              }

              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  onClick={() => handleDaySelection(date)}
                  className={buttonClass}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Hora</span>
              <select
                value={hourValue}
                onChange={handleHourChange}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F9C300]"
              >
                <option value="" disabled>
                  --
                </option>
                {Array.from({ length: 24 }, (_, index) => index)
                  .map((hour) => hour.toString().padStart(2, '0'))
                  .map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Minutos</span>
              <select
                value={minuteValue}
                onChange={handleMinuteChange}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F9C300]"
              >
                <option value="" disabled>
                  --
                </option>
                {Array.from({ length: 12 }, (_, index) => index * 5)
                  .map((minute) => minute.toString().padStart(2, '0'))
                  .map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-gray-500 underline"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 bg-[#F9C300] text-[#1C2E4A] text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default FechaHoraFalloPicker;
