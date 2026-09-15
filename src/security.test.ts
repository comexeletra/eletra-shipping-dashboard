import { describe, expect, it } from 'vitest';
import { validatePublishedSheetUrl } from './security';

describe('published spreadsheet URLs', () => {
  it('accepts HTTPS URLs from Google Sheets', () => {
    expect(validatePublishedSheetUrl('https://docs.google.com/spreadsheets/d/example/pub?output=csv').hostname).toBe('docs.google.com');
  });

  it('rejects untrusted or insecure origins', () => {
    expect(() => validatePublishedSheetUrl('http://docs.google.com/spreadsheets/d/example')).toThrow();
    expect(() => validatePublishedSheetUrl('https://example.com/data.csv')).toThrow();
  });
});
