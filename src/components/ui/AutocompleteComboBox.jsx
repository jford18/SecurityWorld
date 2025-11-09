// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";

const AutocompleteComboBox = ({
  label,
  endpoint,
  items: providedItems,
  value,
  onChange,
  placeholder = "Buscar...",
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
  };

  const isEmpty = !loading && filteredItems.length === 0;

  return (
    <div className="flex flex-col space-y-2">
      {label && (
        <label className="text-sm font-medium text-[#1C2E4A]">{label}</label>
      )}
      <div
        className={`p-2 rounded-2xl border border-gray-200 shadow-sm ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            disabled={disabled}
            className="border-none bg-transparent px-2 py-1 text-sm text-gray-700 placeholder:text-gray-400 focus:border-none focus:outline-none focus:ring-0"
          />
          {selectedLabel && (
            <div className="px-2 pb-1 text-xs text-gray-500">
              Seleccionado:{" "}
              <span className="font-medium text-gray-700">{selectedLabel}</span>
            </div>
          )}
          <CommandList className="max-h-48 overflow-y-auto space-y-1">
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
                    className={`cursor-pointer rounded-md px-2 py-1 text-sm transition-colors ${
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
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

export default AutocompleteComboBox;
