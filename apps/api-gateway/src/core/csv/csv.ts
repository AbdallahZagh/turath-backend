export type CsvCell = string | number | boolean | null | undefined;

/** Spreadsheets run a cell that starts with one of these as a formula, so text from users must not. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows → CSV text for Excel and friends: comma separated, CRLF lines and a UTF-8
 * byte order mark so Arabic shows correctly (same as the frontend's `exportToCsv`).
 * Text that would run as a spreadsheet formula gets a leading `'`.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','));
  return `﻿${lines.join('\r\n')}`;
}
