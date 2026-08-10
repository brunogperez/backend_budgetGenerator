import { normalizeDriveUrl, ImportError } from '../services/import.service';

describe('normalizeDriveUrl', () => {
  it('convierte link de archivo de Drive a descarga directa', () => {
    expect(
      normalizeDriveUrl('https://drive.google.com/file/d/1AbC-_9xYz/view?usp=sharing')
    ).toBe('https://drive.google.com/uc?export=download&id=1AbC-_9xYz');
  });

  it('convierte link con ?id= a descarga directa', () => {
    expect(
      normalizeDriveUrl('https://drive.google.com/open?id=1AbC-_9xYz')
    ).toBe('https://drive.google.com/uc?export=download&id=1AbC-_9xYz');
  });

  it('convierte link de Google Sheets a export xlsx', () => {
    expect(
      normalizeDriveUrl('https://docs.google.com/spreadsheets/d/1AbC-_9xYz/edit#gid=0')
    ).toBe('https://docs.google.com/spreadsheets/d/1AbC-_9xYz/export?format=xlsx');
  });

  it('rechaza URLs que no son de Drive/Sheets', () => {
    expect(() => normalizeDriveUrl('https://example.com/archivo.xlsx')).toThrow(ImportError);
    expect(() => normalizeDriveUrl('texto cualquiera')).toThrow(ImportError);
  });

  it('ImportError tiene status 400 por defecto', () => {
    try {
      normalizeDriveUrl('https://example.com');
      fail('debería lanzar');
    } catch (e) {
      expect((e as ImportError).status).toBe(400);
    }
  });
});
