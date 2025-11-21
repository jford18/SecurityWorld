// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";

const AutocompleteComboBox = ({
  label,
  endpoint,
  items: providedItems,
  value,
  onChange,
  placeholder = "Seleccione...",
  searchPlaceholder = "Buscar...",
  displayField = "nombre",
  valueField = "id",
  disabled = false,
  emptyMessage = "No se encontraron resultados",
  loadingMessage = "Cargando...",
  error,
  onItemSelect,
}) => {
  const [fetchedItems, setFetchedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const isValidEndpoint = (value) => {
    if (typeof value !== "string") return true;
    const candidate = value.trim();
    const FRONTEND_SOURCE_REGEX = /(\/(?:src)\/|\\src\\|\.(?:ts|tsx|js|jsx)$)/i;
    return !FRONTEND_SOURCE_REGEX.test(candidate);
  };

  const items = useMemo(() => {
    if (Array.isArray(providedItems) && providedItems.length > 0) {
      return providedItems;
    }
    return fetchedItems;
  }, [providedItems, fetchedItems]);

  const getItemValue = (item) => {
    if (!item || typeof item !== "object") {
      return "";
    }
    if (valueField && Object.prototype.hasOwnProperty.call(item, valueField)) {
      return item[valueField];
    }
    if (Object.prototype.hasOwnProperty.call(item, "id")) {
      return item.id;
    }
    if (Object.prototype.hasOwnProperty.call(item, "value")) {
      return item.value;
    }
    return "";
  };

  const getItemLabel = (item) => {
    if (!item || typeof item !== "object") {
      return "";
    }
    if (displayField && Object.prototype.hasOwnProperty.call(item, displayField)) {
      const raw = item[displayField];
      return raw == null ? "" : String(raw);
    }
    if (Object.prototype.hasOwnProperty.call(item, "label")) {
      const raw = item.label;
      return raw == null ? "" : String(raw);
    }
    const valueCandidate = getItemValue(item);
    return valueCandidate == null ? "" : String(valueCandidate);
  };

  useEffect(() => {
    if (!endpoint) {
      return;
    }

    if (!isValidEndpoint(endpoint)) {
      console.error(
        `[AutocompleteComboBox] ${label ?? "Combo"}:`,
        `Se bloqueó una solicitud inválida hacia "${endpoint}" para evitar leer archivos de frontend.`,
      );
      setFetchError("Endpoint inválido");
      setFetchedItems([]);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!isMounted) {
          return;
        }

        if (Array.isArray(data)) {
          setFetchedItems(data);
        } else if (data && Array.isArray(data.data)) {
          setFetchedItems(data.data);
        } else {
          setFetchedItems([]);
        }
      } catch (error) {
        console.error(`[AutocompleteComboBox] ${label ?? "Combo"}:`, error);
        if (isMounted) {
          setFetchError("Error al cargar datos");
          setFetchedItems([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [endpoint, label]);

  useEffect(() => {
    const matched = items.find((item) => String(getItemValue(item) ?? "") === String(value ?? ""));
    if (matched) {
      setSelectedLabel(getItemLabel(matched));
    } else if (value == null || value === "") {
      setSelectedLabel("");
    }
  }, [items, value, displayField, valueField]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return items;
    }
    return items.filter((item) => getItemLabel(item).toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(timer);
    };
  }, [isOpen]);

  const handleSelect = (selectedValue) => {
    const normalizedValue = selectedValue != null ? String(selectedValue) : "";
    const matchedItem = items.find((item) => String(getItemValue(item) ?? "") === normalizedValue);

    if (typeof onChange === "function") {
      onChange(normalizedValue);
    }

    if (typeof onItemSelect === "function" && matchedItem) {
      onItemSelect(matchedItem);
    }

    setSelectedLabel(matchedItem ? getItemLabel(matchedItem) : "");
    setQuery("");
    setIsOpen(false);
  };

  const isEmpty = !loading && filteredItems.length === 0;

  return (
    <div className="flex flex-col space-y-2" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-[#1C2E4A]">{label}</label>
      )}
      <div className={`relative ${disabled ? "opacity-60" : ""}`}>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setIsOpen((prev) => !prev);
          }}
          className={`flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2 text-left text-sm text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9C300] ${
            disabled ? "cursor-not-allowed bg-gray-50" : "hover:border-[#F9C300]"
          }`}
        >
          <span className={selectedLabel ? "text-gray-900" : "text-gray-400"}>
            {selectedLabel || placeholder}
          </span>
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && !disabled && (
          <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            <Command>
              <CommandInput
                ref={inputRef}
                placeholder={searchPlaceholder}
                value={query}
                onValueChange={setQuery}
                disabled={disabled}
                className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#F9C300] focus:outline-none focus:ring-1 focus:ring-[#F9C300]"
              />
              <CommandList className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {loading && (
                  <div className="p-2 text-center text-sm text-gray-500">{loadingMessage}</div>
                )}
                {fetchError && !loading && (
                  <div className="p-2 text-center text-sm text-red-500">{fetchError}</div>
                )}
                {isEmpty && (
                  <div className="p-2 text-center text-sm text-gray-400">{emptyMessage}</div>
                )}
                {!loading &&
                  filteredItems.map((item, index) => {
                    const itemValue = getItemValue(item);
                    const key = `${String(itemValue ?? index)}-${index}`;
                    const isSelected = String(value ?? "") === String(itemValue ?? "");
                    return (
                      <CommandItem
                        key={key}
                        value={itemValue != null ? String(itemValue) : ""}
                        onSelect={handleSelect}
                        className={`w-full cursor-pointer rounded-md px-2 py-1 text-sm transition-colors ${
                          isSelected
                            ? "bg-gray-100 text-gray-900"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        {getItemLabel(item)}
                      </CommandItem>
                    );
                  })}
              </CommandList>
            </Command>
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

export default AutocompleteComboBox;
