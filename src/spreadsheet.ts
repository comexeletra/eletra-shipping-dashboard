import * as XLSX from 'xlsx';
import type { ProcessRecord } from './types';

type Row = Record<string, unknown>;

export const MAX_RECORDS = 10_000;
const MAX_COLUMNS = 150;
const MAX_CELL_LENGTH = 5_000;

const aliases: Record<string, string[]> = {
  id: ['processo', 'process', 'process number', 'fup', 'id'],
  po: ['po', 'purchase order', 'pedido de compra'],
  group: ['grupo', 'group', 'empresa', 'company'],
  supplier: ['fornecedor', 'supplier', 'vendor'],
  status: ['status', 'situação', 'situacao'],
  priority: ['prioridade', 'priority'],
  mode: ['modal', 'mode', 'frete'],
  analyst: ['analista', 'analyst', 'responsável', 'responsavel'],
  eta: ['eta'],
  ete: ['ete', 'entrega esperada', 'estimated delivery'],
  etd: ['etd'],
  incoterm: ['incoterm'],
  storage: ['armazenagem', 'storage'],
  demurrage: ['demurrage'],
  fines: ['multa', 'multas', 'fine', 'fines']
};

const clean = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function value(row: Row, field: string): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases[field] ?? []) {
    const match = entries.find(([key]) => clean(key) === clean(alias));
    if (match) return match[1];
  }
  return '';
}

function text(input: unknown): string {
  return String(input ?? '').trim().slice(0, MAX_CELL_LENGTH);
}

function number(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const normalized = text(input).replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(input: unknown): string {
  if (typeof input === 'number' && input > 10_000 && input < 100_000) {
    const parsed = XLSX.SSF.parse_date_code(input);
    return parsed ? `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}` : '';
  }
  return text(input);
}

export function normalizeRows(rows: Row[]): ProcessRecord[] {
  return rows.slice(0, MAX_RECORDS)
    .map((raw, index) => ({
      id: text(value(raw, 'id')) || `linha-${index + 1}`,
      po: text(value(raw, 'po')),
      group: text(value(raw, 'group')),
      supplier: text(value(raw, 'supplier')),
      status: text(value(raw, 'status')) || 'Sem status',
      priority: Number.isFinite(number(value(raw, 'priority'))) && number(value(raw, 'priority')) > 0 ? number(value(raw, 'priority')) : null,
      mode: text(value(raw, 'mode')),
      analyst: text(value(raw, 'analyst')),
      eta: date(value(raw, 'eta')),
      ete: date(value(raw, 'ete')),
      etd: date(value(raw, 'etd')),
      incoterm: text(value(raw, 'incoterm')),
      storage: number(value(raw, 'storage')),
      demurrage: number(value(raw, 'demurrage')),
      fines: number(value(raw, 'fines')),
      raw
    }))
    .filter((record) => record.id !== '');
}

export function parseWorkbook(input: ArrayBuffer | string): ProcessRecord[] {
  const workbook = XLSX.read(input, {
    type: typeof input === 'string' ? 'string' : 'array',
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    dense: true
  });
  const preferred = workbook.SheetNames.find((name) => /fup|status|process/i.test(name)) ?? workbook.SheetNames[0];
  if (!preferred) return [];
  const sheet = workbook.Sheets[preferred];
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  range.e.r = Math.min(range.e.r, range.s.r + MAX_RECORDS);
  range.e.c = Math.min(range.e.c, range.s.c + MAX_COLUMNS - 1);
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', range });
  return normalizeRows(rows);
}

export async function parseFile(file: File): Promise<ProcessRecord[]> {
  return parseWorkbook(await file.arrayBuffer());
}
