import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  allLabel?: string;
  className?: string;
}

const MAX_VISIBLE_OPTIONS = 30;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  loading = false,
  allLabel = 'Todos',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const safeOptions = useMemo(() => {
    const base = options.filter((item) => item.value.trim() !== '');
    return [{ value: '', label: allLabel }, ...base];
  }, [allLabel, options]);

  const selectedLabel = useMemo(() => {
    const match = safeOptions.find((item) => item.value === value);
    return match?.label ?? allLabel;
  }, [allLabel, safeOptions, value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const subset = q
      ? safeOptions.filter((item) => item.label.toLowerCase().includes(q))
      : safeOptions;
    return subset.slice(0, MAX_VISIBLE_OPTIONS);
  }, [query, safeOptions]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  return (
    <div className={`min-w-0 ${className}`} ref={containerRef}>
      {label ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p> : null}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-9 w-full truncate rounded-md border border-gray-300 bg-white px-2 text-left text-xs text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          {loading ? 'Cargando...' : selectedLabel || placeholder}
        </button>

        {isOpen && !disabled ? (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-300 bg-white p-2 shadow-lg">
            <div className="mb-2 flex gap-1">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar..."
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="h-8 rounded-md border border-gray-300 px-2 text-[11px] font-medium text-gray-600"
              >
                Limpiar
              </button>
            </div>

            <ul className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <li className="px-2 py-2 text-xs text-gray-500">Sin resultados.</li>
              ) : (
                filteredOptions.map((option) => (
                  <li key={`${option.value}-${option.label}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={`w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100 ${
                        option.value === value ? 'bg-gray-100 font-semibold text-[#1C2E4A]' : 'text-gray-700'
                      }`}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchableSelect;
