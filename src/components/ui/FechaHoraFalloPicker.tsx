import React, { useEffect, useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import { format, isAfter, isSameDay, startOfDay } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

type CustomHeaderProps = {
  date: Date;
  decreaseMonth: () => void;
  increaseMonth: () => void;
  prevMonthButtonDisabled: boolean;
  nextMonthButtonDisabled: boolean;
};

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

  const popperModifiers = useMemo(
    () => [
      { name: 'offset', options: { offset: [0, 8] } },
      { name: 'preventOverflow', options: { altAxis: true, tether: false } },
    ],
    [],
  );

  return (
    <div className="md:col-span-2 w-full max-w-[280px]">
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-semibold text-[#374151]"
      >
        {label}
      </label>
      <div className="relative">
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
          className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-base text-gray-800 placeholder:text-[#9CA3AF] shadow-sm focus:border-[#FACC15] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
          calendarClassName="!bg-white !border !border-[#E5E7EB] !rounded-xl !shadow-lg !p-4 !text-sm !w-full !max-w-[280px]"
          popperClassName="z-50 !w-full !max-w-[280px]"
          popperPlacement="bottom-start"
          popperModifiers={popperModifiers}
          dayClassName={(date: Date) => {
            const baseClasses =
              '!w-9 !h-9 flex items-center justify-center rounded-full text-sm text-gray-700 hover:bg-gray-100';
            const isToday = isSameDay(date, now);
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

            if (isSelected) {
              return `${baseClasses} !bg-[#3B82F6] !text-white`;
            }

            if (isToday) {
              return `${baseClasses} !bg-[#FACC15] !text-gray-900`;
            }

            return baseClasses;
          }}
          timeClassName={(time: Date) => {
            const baseClasses = 'px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg';

            if (
              selectedDate &&
              time.getHours() === selectedDate.getHours() &&
              time.getMinutes() === selectedDate.getMinutes()
            ) {
              return `${baseClasses} !bg-yellow-100 !text-gray-900`;
            }

            return baseClasses;
          }}
          timeCaption="Hora"
          timeContainerClassName="!border-t !border-[#E5E7EB] !bg-white !max-h-[150px] !overflow-y-auto !p-2"
          wrapperClassName="w-full"
          shouldCloseOnSelect={false}
          required={required}
          autoComplete="off"
          renderCustomHeader={(headerProps: CustomHeaderProps) => {
            const {
              date,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            } = headerProps;

            return (
              <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
                <button
                  type="button"
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                  className="rounded-lg px-2 py-1 text-gray-600 transition hover:bg-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  ←
                </button>
                <span className="font-medium capitalize text-gray-700">
                  {format(date, 'MMMM yyyy', { locale: es })}
                </span>
                <button
                  type="button"
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  className="rounded-lg px-2 py-1 text-gray-600 transition hover:bg-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  →
                </button>
              </div>
            );
          }}
        />
        <svg
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
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
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default FechaHoraFalloPicker;
