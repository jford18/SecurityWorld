declare interface DateFnsLocale {
  code?: string;
}

declare module 'date-fns' {
  export type Locale = DateFnsLocale;
  export function format(date: Date | number, formatString: string, options?: { locale?: Locale }): string;
  export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function startOfDay(date: Date | number): Date;
}

declare module 'date-fns/locale/es' {
  import type { Locale } from 'date-fns';
  const locale: Locale;
  export default locale;
}
