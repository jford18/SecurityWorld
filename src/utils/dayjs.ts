import { format as formatDate, isValid as isValidDate, parse as parseDate } from 'date-fns';

export type DayjsInput = Date | string | number | Dayjs | null | undefined;

const normalizePattern = (pattern: string) => {
  const replacements: Array<[RegExp, string]> = [
    [/YYYY/g, 'yyyy'],
    [/YY/g, 'yy'],
    [/DD/g, 'dd'],
    [/HH/g, 'HH'],
    [/hh/g, 'hh'],
    [/mm/g, 'mm'],
    [/ss/g, 'ss'],
    [/A/g, 'aa'],
    [/a/g, 'aa'],
    [/T/g, "'T'"],
    [/Z/g, "'Z'"],
  ];

  return replacements.reduce(
    (current, [search, replacement]) => current.replace(search, replacement),
    pattern,
  );
};

const parseWithFormats = (value: string, formats: string[], strict?: boolean) => {
  for (const format of formats) {
    const mappedFormat = normalizePattern(format);
    const parsed = parseDate(value, mappedFormat, new Date());
    if (!isValidDate(parsed)) {
      continue;
    }

    if (strict) {
      const normalized = formatDate(parsed, mappedFormat);
      if (normalized !== value) {
        continue;
      }
    }

    return parsed;
  }

  return null;
};

class DayjsImpl {
  constructor(private readonly value: Date) {}

  isValid() {
    return isValidDate(this.value);
  }

  format(pattern?: string) {
    if (!this.isValid()) {
      return 'Invalid Date';
    }
    if (!pattern) {
      return this.value.toISOString();
    }
    return formatDate(this.value, normalizePattern(pattern));
  }

  toDate() {
    return new Date(this.value);
  }

  isAfter(other?: DayjsInput) {
    if (!this.isValid()) return false;
    const otherValue = other ? dayjs(other) : null;
    if (!otherValue || !otherValue.isValid()) return false;
    return this.value.getTime() > otherValue.valueOf();
  }

  valueOf() {
    return this.value.getTime();
  }
}

export type Dayjs = DayjsImpl;

const dayjs = (input?: DayjsInput, format?: string | string[], strict?: boolean): Dayjs => {
  if (input instanceof DayjsImpl) {
    return input;
  }

  if (input === null || input === undefined) {
    return new DayjsImpl(new Date(NaN));
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return new DayjsImpl(new Date(NaN));
    }
    const formats = format ? (Array.isArray(format) ? format : [format]) : [];
    if (formats.length > 0) {
      const parsedWithFormats = parseWithFormats(trimmed, formats, strict);
      if (parsedWithFormats) {
        return new DayjsImpl(parsedWithFormats);
      }
    }

    const isoParsed = new Date(trimmed);
    if (isValidDate(isoParsed)) {
      return new DayjsImpl(isoParsed);
    }

    return new DayjsImpl(new Date(NaN));
  }

  if (input instanceof Date) {
    return new DayjsImpl(new Date(input.getTime()));
  }

  if (typeof input === 'number') {
    return new DayjsImpl(new Date(input));
  }

  if ((input as any)?.toDate instanceof Function) {
    try {
      const asDate = (input as any).toDate();
      if (asDate instanceof Date) {
        return new DayjsImpl(new Date(asDate.getTime()));
      }
    } catch {
      return new DayjsImpl(new Date(NaN));
    }
  }

  return new DayjsImpl(new Date(NaN));
};

(dayjs as any).isDayjs = (value: unknown): value is Dayjs => value instanceof DayjsImpl;
(dayjs as any).extend = (plugin: (option?: any, dayjsClass?: typeof DayjsImpl) => void) => {
  if (typeof plugin === 'function') {
    plugin(dayjs as any, DayjsImpl);
  }
};

export default dayjs;
