import { describe, expect, it } from 'vitest';
import { MAX_RECORDS, normalizeRows, parseWorkbook } from './spreadsheet';

describe('spreadsheet parser', () => {
  it('normalizes recognized Portuguese headers and values', () => {
    const [record] = normalizeRows([{
      Processo: ' FUP-001 ',
      Fornecedor: 'Fornecedor A',
      Status: 'Em trânsito',
      Prioridade: '2',
      Armazenagem: 'R$ 1.234,50'
    }]);

    expect(record).toMatchObject({
      id: 'FUP-001',
      supplier: 'Fornecedor A',
      status: 'Em trânsito',
      priority: 2,
      storage: 1234.5
    });
  });

  it('reads a published CSV and caps its records', () => {
    const records = parseWorkbook('Processo,Status\nFUP-001,Em trânsito\nFUP-002,Entregue');
    expect(records.map((record) => record.id)).toEqual(['FUP-001', 'FUP-002']);

    const manyRows = Array.from({ length: MAX_RECORDS + 1 }, (_, index) => ({ Processo: `FUP-${index}` }));
    expect(normalizeRows(manyRows)).toHaveLength(MAX_RECORDS);
  });
});
