import type { FC } from 'react';

declare module '@/components/ui/AutocompleteComboBox' {
  export interface AutocompleteComboBoxProps {
    label?: string;
    endpoint?: string;
    items?: Array<Record<string, unknown>>;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    displayField?: string;
    valueField?: string;
    disabled?: boolean;
    emptyMessage?: string;
    loadingMessage?: string;
    error?: string;
    onItemSelect?: (item: Record<string, unknown>) => void;
  }

  const AutocompleteComboBox: FC<AutocompleteComboBoxProps>;
  export default AutocompleteComboBox;
}

declare module '../ui/AutocompleteComboBox' {
  export { default } from '@/components/ui/AutocompleteComboBox';
  export type { AutocompleteComboBoxProps } from '@/components/ui/AutocompleteComboBox';
}

declare module './ui/AutocompleteComboBox' {
  export { default } from '@/components/ui/AutocompleteComboBox';
  export type { AutocompleteComboBoxProps } from '@/components/ui/AutocompleteComboBox';
}
