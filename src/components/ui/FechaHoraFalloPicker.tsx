import React, { useEffect, useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import esLocale from 'date-fns/locale/es';
import { format, isAfter, isSameDay, startOfDay, parse, isValid } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

type CustomHeaderProps = {
  date: Date;
  decreaseMonth: () => void;
  increaseMonth: () => void;
  prevMonthButtonDisabled: boolean;
  nextMonthButtonDisabled: boolean;
};

type CalendarContainerProps = {
  className?: string;
  children?: React.ReactNode;
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
  timeIntervalMinutes?: number;
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

registerLocale('es', esLocale);

const clampToEndOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const parseInputDate = (inputValue: string): Date | null => {
  const trimmed = inputValue.trim();
  if (!trimmed) {
    return null;
  }

  const candidateFormats = [
    'dd/MM/yyyy HH:mm',
    'dd/MM/yyyy, HH:mm',
    "yyyy-MM-dd'T'HH:mm",
  ];

  for (const formatString of candidateFormats) {
    const parsed = parse(trimmed, formatString, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  const fallbackDate = new Date(trimmed);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

const FechaHoraFalloPicker: React.FC<FechaHoraFalloPickerProps> = ({
  id,
  name,
  label = 'Fecha y Hora del Fallo *',
  value,
  onChange,
  placeholder = 'dd/mm/aaaa hh:mm',
  required,
  error,
  timeIntervalMinutes = 5,
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

  const handleInputBlur = (inputValue: string) => {
    const parsed = parseInputDate(inputValue);

    if (parsed) {
      handleDateChange(parsed);
      return;
    }

    if (!inputValue.trim()) {
      handleDateChange(null);
    }
  };

  const CustomCalendarContainer: React.FC<CalendarContainerProps> = ({
    className,
    children,
  }) => {
    const enhancedChildren = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) {
        return child;
      }

      const childElement = child as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;

      if (
        typeof childElement.props?.className === 'string' &&
        childElement.props.className.includes('react-datepicker')
      ) {
        const innerChildren = React.Children.map(childElement.props.children, (grandChild) => {
          if (!React.isValidElement(grandChild)) {
            return grandChild;
          }

          const grandChildElement = grandChild as React.ReactElement<{
            className?: string;
          }>;

          const grandChildClassName = grandChildElement.props?.className ?? '';

          if (grandChildClassName.includes('react-datepicker__month-container')) {
            return React.cloneElement(grandChildElement, {
              className: `${grandChildClassName} flex-[0.7] min-w-0`,
            });
          }

          if (grandChildClassName.includes('react-datepicker__time-container')) {
            return React.cloneElement(grandChildElement, {
              className: `${grandChildClassName} flex-[0.3] min-w-0 !border !border-[#E5E7EB] !rounded-xl !bg-white`,
            });
          }

          return grandChildElement;
        });

        return React.cloneElement(childElement, {
          className: `${childElement.props.className ?? ''} !flex !flex-row !w-full !items-start !gap-4 !bg-transparent !border-none !shadow-none`,
          children: innerChildren,
        });
      }

      return childElement;
    });

    return (
      <div className={`${className ?? ''} rounded-xl bg-white p-4 shadow-md`}>{enhancedChildren}</div>
    );
  };

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
          onChangeRaw={(event) => {
            if (!(event?.target instanceof HTMLInputElement)) {
              return;
            }

            if (!event.target.value.trim()) {
              handleDateChange(null);
            }
          }}
          onBlur={(event) => handleInputBlur(event.target.value)}
          showTimeSelect
          timeIntervals={timeIntervalMinutes}
          timeFormat="HH:mm"
          dateFormat="dd/MM/yyyy HH:mm"
          locale="es"
          maxDate={now}
          minTime={minTime}
          maxTime={maxTime}
          placeholderText={placeholder}
          className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm text-gray-800 placeholder:text-[#9CA3AF] shadow-sm focus:border-[#FACC15] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
          calendarClassName="!w-full !text-sm"
          calendarContainer={CustomCalendarContainer}
          popperClassName="z-50"
          popperPlacement="bottom-start"
          popperModifiers={popperModifiers}
          showPopperArrow={false}
          dayClassName={(date: Date) => {
            const baseClasses =
              '!w-9 !h-9 flex items-center justify-center rounded-full text-sm text-gray-700 transition-colors hover:bg-[#FACC15]/60 hover:text-gray-900';
            const isToday = isSameDay(date, now);
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

            if (isSelected) {
              return `${baseClasses} !bg-[#3B82F6] !text-white hover:!bg-[#2563EB]`;
            }

            if (isToday) {
              return `${baseClasses} !bg-[#FACC15] !text-gray-900`;
            }

            return baseClasses;
          }}
          timeClassName={(time: Date) => {
            const baseClasses =
              'px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-[#FACC15]/60 hover:text-gray-900 rounded-lg';

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
          timeContainerClassName="!border !border-[#E5E7EB] !bg-white !max-h-[220px] !overflow-y-auto !p-3 !flex !flex-col !rounded-xl"
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
                  className="rounded-lg px-2 py-1 text-gray-600 transition hover:bg-[#FACC15]/60 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  ←
                </button>
                <span className="font-medium capitalize text-gray-700">
                  {format(date, 'MMMM yyyy', { locale: esLocale })}
                </span>
                <button
                  type="button"
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  className="rounded-lg px-2 py-1 text-gray-600 transition hover:bg-[#FACC15]/60 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300"
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
