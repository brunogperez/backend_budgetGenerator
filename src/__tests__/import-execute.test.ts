import { setupTestDB, clearTestDB, teardownTestDB } from './setup';
import Product from '../models/Product';
import {
  buildPreview,
  executeImport,
  ImportError,
  ParseResult
} from '../services/import.service';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

beforeAll(async () => { await setupTestDB(); });
afterEach(async () => { await clearTestDB(); });
afterAll(async () => { await teardownTestDB(); });

function makeParse(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    rows: [
      { row: 2, sku: 'NEW-1', name: 'Nuevo', description: 'D', price: 10, stock: 1, category: 'C' },
      { row: 3, sku: 'EXIST-1', name: 'Actualizado', description: 'D2', price: 20, stock: 2, category: 'C' }
    ],
    errors: [{ row: 4, errors: ['price debe ser un número'] }],
    warnings: [],
    ...overrides
  };
}

async function seedExisting() {
  await Product.create({
    sku: 'EXIST-1', name: 'Viejo', description: 'Desc', price: 1, stock: 99, category: 'C'
  });
  await Product.create({
    sku: 'UNTOUCHED-1', name: 'Intacto', description: 'Desc', price: 5, stock: 7, category: 'C'
  });
}

describe('buildPreview', () => {
  it('clasifica create/update y arma summary', async () => {
    await seedExisting();
    const preview = await buildPreview(makeParse());

    expect(preview.summary).toEqual({ total: 3, toCreate: 1, toUpdate: 1, invalid: 1 });
    expect(preview.rows).toEqual([
      { row: 2, action: 'create', sku: 'NEW-1', name: 'Nuevo', price: 10, stock: 1 },
      { row: 3, action: 'update', sku: 'EXIST-1', name: 'Actualizado', price: 20, stock: 2 }
    ]);
    expect(preview.errors).toHaveLength(1);
  });
});

describe('executeImport', () => {
  it('crea nuevos, actualiza existentes, no toca ausentes', async () => {
    await seedExisting();
    const result = await executeImport(makeParse());

    expect(result.summary).toEqual({ created: 1, updated: 1, invalid: 1 });

    const created = await Product.findOne({ sku: 'NEW-1' }).lean();
    expect(created).toMatchObject({ name: 'Nuevo', price: 10, stock: 1, isActive: true });

    const updated = await Product.findOne({ sku: 'EXIST-1' }).lean();
    expect(updated).toMatchObject({ name: 'Actualizado', price: 20, stock: 2 });

    const untouched = await Product.findOne({ sku: 'UNTOUCHED-1' }).lean();
    expect(untouched).toMatchObject({ name: 'Intacto', price: 5, stock: 7 });
  });

  it('no reactiva productos inactivos existentes ni desactiva nada', async () => {
    await Product.create({
      sku: 'EXIST-1', name: 'Viejo', description: 'Desc', price: 1, stock: 99,
      category: 'C', isActive: false
    });
    await executeImport(makeParse());

    const updated = await Product.findOne({ sku: 'EXIST-1' }).lean();
    // $setOnInsert solo aplica en creación: isActive se mantiene false
    expect(updated!.isActive).toBe(false);
    expect(updated!.name).toBe('Actualizado');
  });

  it('lanza ImportError si no hay filas válidas', async () => {
    const parse = makeParse({ rows: [] });
    await expect(executeImport(parse)).rejects.toThrow(ImportError);
  });
});
