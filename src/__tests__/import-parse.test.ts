import ExcelJS from 'exceljs';
import { parseCatalog, ImportError } from '../services/import.service';

const HEADERS = ['sku', 'name', 'description', 'price', 'stock', 'category', 'imageUrl'];

async function buildXlsx(
  rows: Array<Record<string, unknown>>,
  headers: string[] = HEADERS
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Catalogo');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(headers.map((h) => r[h])));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const validRow = {
  sku: 'ABC-1',
  name: 'Producto 1',
  description: 'Descripción 1',
  price: 100.5,
  stock: 5,
  category: 'General',
  imageUrl: 'https://example.com/img.png'
};

describe('parseCatalog', () => {
  it('parsea filas válidas', async () => {
    const buf = await buildXlsx([validRow, { ...validRow, sku: 'ABC-2', imageUrl: undefined }]);
    const result = await parseCatalog(buf);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!).toEqual({ row: 2, ...validRow });
    expect(result.rows[1]!.imageUrl).toBeUndefined();
  });

  it('acepta headers en cualquier orden y case', async () => {
    const headers = ['NAME', 'Sku', 'price', 'STOCK', 'category', 'description'];
    const buf = await buildXlsx(
      [{ NAME: 'P', Sku: 'X-1', price: 1, STOCK: 2, category: 'C', description: 'D' }],
      headers
    );
    const result = await parseCatalog(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.sku).toBe('X-1');
  });

  it('reporta filas inválidas sin abortar el resto', async () => {
    const buf = await buildXlsx([
      validRow,
      { ...validRow, sku: 'BAD SKU!', price: -5 },      // fila 3: sku y price inválidos
      { ...validRow, sku: 'ABC-3', stock: 1.5 }          // fila 4: stock no entero
    ]);
    const result = await parseCatalog(buf);

    expect(result.rows.map((r) => r.sku)).toEqual(['ABC-1']);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.row).toBe(3);
    expect(result.errors[0]!.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors[1]!.row).toBe(4);
  });

  it('SKU duplicado: última fila gana y genera warning', async () => {
    const buf = await buildXlsx([
      validRow,
      { ...validRow, name: 'Versión nueva' }
    ]);
    const result = await parseCatalog(buf);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.name).toBe('Versión nueva');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!).toContain('ABC-1');
  });

  it('rechaza si faltan headers requeridos', async () => {
    const buf = await buildXlsx(
      [{ sku: 'A-1', name: 'P' }],
      ['sku', 'name']
    );
    await expect(parseCatalog(buf)).rejects.toThrow(/price/);
  });

  it('rechaza hoja sin filas de datos', async () => {
    const buf = await buildXlsx([]);
    await expect(parseCatalog(buf)).rejects.toThrow(ImportError);
  });

  it('rechaza buffer que no es xlsx', async () => {
    await expect(parseCatalog(Buffer.from('no soy un excel'))).rejects.toThrow(
      /Excel/
    );
  });

  it('valida longitudes máximas', async () => {
    const buf = await buildXlsx([
      { ...validRow, name: 'x'.repeat(201) },
      { ...validRow, sku: 'ABC-9', description: 'x'.repeat(1001) }
    ]);
    const result = await parseCatalog(buf);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });
});
