import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  error?: string;
  onInvalidDate?: (isInvalid: boolean) => void;
};

const toLocalInputString = (date: Date): string => {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffset);
  return localDate.toISOString().slice(0, 16);
};

const formatInputValue = (value: string): string => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return toLocalInputString(parsed);
};

const FechaHoraFalloPicker: React.FC<Props> = ({
  value,
  onChange,
  id,
  name,
  required,
  error,
  onInvalidDate,
}) => {
  const [internalError, setInternalError] = useState('');
  const maxValue = toLocalInputString(new Date());

  useEffect(() => {
    if (!value) {
      setInternalError('');
      onInvalidDate?.(false);
      return;
    }

    const selectedDate = new Date(value);
    if (Number.isNaN(selectedDate.getTime())) {
      setInternalError('Seleccione una fecha y hora válidas.');
      onInvalidDate?.(true);
      return;
    }

    const now = new Date();
    if (selectedDate.getTime() > now.getTime()) {
      setInternalError('No puedes seleccionar una fecha y hora futura.');
      onInvalidDate?.(true);
    } else {
      setInternalError('');
      onInvalidDate?.(false);
    }
  }, [value, onInvalidDate]);

  const handleChange = (inputValue: string) => {
    if (!inputValue) {
      setInternalError('');
      onInvalidDate?.(false);
      onChange('');
      return;
    }

    const selectedDate = new Date(inputValue);
    if (Number.isNaN(selectedDate.getTime())) {
      setInternalError('Seleccione una fecha y hora válidas.');
      onInvalidDate?.(true);
      onChange('');
      return;
    }

    const isoValue = selectedDate.toISOString();
    const now = new Date();

    if (selectedDate.getTime() > now.getTime()) {
      setInternalError('No puedes seleccionar una fecha y hora futura.');
      onInvalidDate?.(true);
    } else {
      setInternalError('');
      onInvalidDate?.(false);
    }

    onChange(isoValue);
  };

  const inputValue = useMemo(() => formatInputValue(value), [value]);
  const helperMessage = internalError || error || '';

  return (
    <div className="w-full">
      <input
        id={id}
        name={name}
        type="datetime-local"
        value={inputValue}
        onChange={(event) => handleChange(event.target.value)}
        max={maxValue}
        required={required}
        className={`
          mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm
          focus:ring-[#F9C300] focus:border-[#F9C300]
          ${helperMessage ? 'border-red-400' : 'border-gray-300'}
        `}
      />
      {helperMessage && <p className="text-xs text-red-500 mt-1">{helperMessage}</p>}
    </div>
  );
};

export default FechaHoraFalloPicker;
