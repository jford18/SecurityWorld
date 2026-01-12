import XLSX from "xlsx";

class Worksheet {
  constructor(name) {
    this.name = name;
    this.columns = [];
    this._rows = [];
  }

  addRows(rows) {
    if (Array.isArray(rows)) {
      this._rows.push(...rows);
    }
  }

  get rows() {
    return this._rows;
  }
}

class Workbook {
  constructor() {
    this._worksheets = [];
  }

  addWorksheet(name) {
    const worksheet = new Worksheet(name);
    this._worksheets.push(worksheet);
    return worksheet;
  }

  get xlsx() {
    return {
      writeBuffer: async () => {
        const workbook = XLSX.utils.book_new();

        this._worksheets.forEach((sheet) => {
          const headers = sheet.columns.map((column) => column.header);
          const dataRows = sheet.rows.map((row) =>
            sheet.columns.map((column) => row?.[column.key] ?? null)
          );
          const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
        });

        return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
      },
    };
  }
}

export { Workbook };
export default { Workbook };
