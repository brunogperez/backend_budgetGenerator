import request from 'supertest';
import ExcelJS from 'exceljs';
import { app } from '../server';
import { setupTestDB, clearTestDB, teardownTestDB } from './setup';
import Product from '../models/Product';
import User from '../models/User';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const DRIVE_URL = 'https://drive.google.com/file/d/FILE123/view';

async function buildXlsxBuffer(rows: Array<Record<string, unknown>>): Promise<Buffer> {
  const headers = ['sku', 'name', 'description', 'price', 'stock', 'category'];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Catalogo');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(headers.map((h) => r[h])));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function mockFetchWithXlsx(body: Buffer): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/octet-stream' },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
  });
}

async function getAdminToken(): Promise<string> {
  await User.create({
    name: 'Admin', email: 'admin@test.com', password: 'Password123', role: 'admin'
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'Password123' });
  return res.body.data.token;
}

beforeAll(async () => { await setupTestDB(); });
afterEach(async () => {
  await clearTestDB();
  jest.restoreAllMocks();
});
afterAll(async () => { await teardownTestDB(); });

describe('POST /api/products/import/preview', () => {
  it('rechaza sin token (401)', async () => {
    const res = await request(app)
      .post('/api/products/import/preview')
      .send({ url: DRIVE_URL });
    expect(res.status).toBe(401);
  });

  it('rechaza usuario no admin (403)', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'User', email: 'user@test.com', password: 'Password123'
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password123' });

    const res = await request(app)
      .post('/api/products/import/preview')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ url: DRIVE_URL });
    expect(res.status).toBe(403);
  });

  it('rechaza URL que no es de Drive (400, sin descargar)', async () => {
    const token = await getAdminToken();
    global.fetch = jest.fn();

    const res = await request(app)
      .post('/api/products/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/archivo.xlsx' });

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('devuelve preview con summary y errores por fila', async () => {
    const token = await getAdminToken();
    await Product.create({
      sku: 'EXIST-1', name: 'Viejo', description: 'D', price: 1, stock: 1, category: 'C'
    });
    const xlsx = await buildXlsxBuffer([
      { sku: 'NEW-1', name: 'Nuevo', description: 'D', price: 10, stock: 1, category: 'C' },
      { sku: 'EXIST-1', name: 'Upd', description: 'D', price: 20, stock: 2, category: 'C' },
      { sku: 'BAD!', name: 'Malo', description: 'D', price: -1, stock: 1, category: 'C' }
    ]);
    mockFetchWithXlsx(xlsx);

    const res = await request(app)
      .post('/api/products/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: DRIVE_URL });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ total: 3, toCreate: 1, toUpdate: 1, invalid: 1 });
    expect(res.body.data.errors).toHaveLength(1);
    // Preview NO modifica la DB
    expect(await Product.countDocuments()).toBe(1);
  });
});

describe('POST /api/products/import', () => {
  it('importa: crea y actualiza por SKU', async () => {
    const token = await getAdminToken();
    await Product.create({
      sku: 'EXIST-1', name: 'Viejo', description: 'D', price: 1, stock: 1, category: 'C'
    });
    const xlsx = await buildXlsxBuffer([
      { sku: 'NEW-1', name: 'Nuevo', description: 'D', price: 10, stock: 1, category: 'C' },
      { sku: 'EXIST-1', name: 'Upd', description: 'D', price: 20, stock: 2, category: 'C' }
    ]);
    mockFetchWithXlsx(xlsx);

    const res = await request(app)
      .post('/api/products/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: DRIVE_URL });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ created: 1, updated: 1, invalid: 0 });
    expect(await Product.countDocuments()).toBe(2);
    const updated = await Product.findOne({ sku: 'EXIST-1' }).lean();
    expect(updated!.name).toBe('Upd');
  });

  it('archivo no público devuelve 400 con mensaje accionable', async () => {
    const token = await getAdminToken();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html; charset=utf-8' },
      arrayBuffer: async () => new ArrayBuffer(0)
    });

    const res = await request(app)
      .post('/api/products/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: DRIVE_URL });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/públic/);
  });
});
