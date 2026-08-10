/**
 * Servicio de importación de catálogo desde Excel de Google Drive.
 * Pipeline: normalizar URL → descargar → parsear → validar → upsert por SKU.
 */

import ExcelJS from 'exceljs';
import Product from '../models/Product';

export interface ParsedRow {
  row: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
}

export interface RowError {
  row: number;
  errors: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  warnings: string[];
}

export class ImportError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'ImportError';
    this.status = status;
  }
}

const SHEETS_URL_RE = /docs\.google\.com\/spreadsheets\/d\/([\w-]+)/;
const DRIVE_FILE_URL_RE = /drive\.google\.com\/file\/d\/([\w-]+)/;
const DRIVE_ID_PARAM_RE = /drive\.google\.com\/[^\s]*[?&]id=([\w-]+)/;

/**
 * Convierte un link compartido de Drive/Sheets en URL de descarga directa xlsx.
 */
export function normalizeDriveUrl(url: string): string {
  const sheets = url.match(SHEETS_URL_RE);
  if (sheets) {
    return `https://docs.google.com/spreadsheets/d/${sheets[1]}/export?format=xlsx`;
  }

  const file = url.match(DRIVE_FILE_URL_RE) || url.match(DRIVE_ID_PARAM_RE);
  if (file) {
    return `https://drive.google.com/uc?export=download&id=${file[1]}`;
  }

  throw new ImportError(
    'La URL debe ser un link compartido de Google Drive o Google Sheets'
  );
}

const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Descarga el xlsx desde Drive. Detecta respuestas HTML (página de login o
 * de confirmación de Drive) como "archivo no público".
 */
export async function downloadDriveFile(url: string): Promise<Buffer> {
  const target = normalizeDriveUrl(url);

  let response: Response;
  try {
    response = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    });
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ImportError('Tiempo de espera agotado descargando el archivo de Drive');
    }
    throw new ImportError('No se pudo descargar el archivo de Google Drive');
  }

  if (!response.ok) {
    throw new ImportError('El archivo no es accesible públicamente o no existe');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new ImportError(
      'El archivo no es accesible públicamente. Compartilo con "cualquiera con el enlace"'
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new ImportError('El archivo descargado está vacío');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new ImportError('El archivo supera el límite de 10 MB');
  }

  return buffer;
}

const REQUIRED_HEADERS = ['sku', 'name', 'description', 'price', 'stock', 'category'];
const SKU_RE = /^[A-Za-z0-9\-_]+$/;

/** Extrae texto plano de una celda (maneja richText, fórmulas, hyperlinks). */
function cellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const obj = v as unknown as Record<string, unknown>;
    if ('result' in obj) return String(obj.result ?? '').trim();
    if ('richText' in obj) {
      return (obj.richText as Array<{ text: string }>).map((r) => r.text).join('').trim();
    }
    if ('text' in obj) return String(obj.text).trim();
    if ('hyperlink' in obj) return String(obj.hyperlink).trim();
    return '';
  }
  return String(v).trim();
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parsea la primera hoja del workbook. Fila 1 = headers (case-insensitive,
 * orden libre). Filas inválidas se acumulan en errors sin abortar.
 */
export async function parseCatalog(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportError('El archivo no es un Excel (.xlsx) válido');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new ImportError('La hoja está vacía o no tiene filas de datos');
  }

  const colMap: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = cellString(cell).toLowerCase();
    if (key) colMap[key] = colNumber;
  });

  const missing = REQUIRED_HEADERS.filter((h) => !(h in colMap));
  if (missing.length > 0) {
    throw new ImportError(`Faltan columnas requeridas: ${missing.join(', ')}`);
  }

  const errors: RowError[] = [];
  const warnings: string[] = [];
  // Map por SKU: última fila con el mismo SKU pisa a la anterior.
  const bySku = new Map<string, ParsedRow>();
  const firstRowOfSku = new Map<string, number>();

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);

    const sku = cellString(row.getCell(colMap.sku!));
    const name = cellString(row.getCell(colMap.name!));
    const description = cellString(row.getCell(colMap.description!));
    const priceRaw = cellString(row.getCell(colMap.price!));
    const stockRaw = cellString(row.getCell(colMap.stock!));
    const category = cellString(row.getCell(colMap.category!));
    const imageUrl = 'imageurl' in colMap ? cellString(row.getCell(colMap.imageurl!)) : '';

    // Fila completamente vacía: se ignora en silencio
    if (!sku && !name && !description && !priceRaw && !stockRaw && !category) {
      continue;
    }

    const rowErrors: string[] = [];
    const price = Number(priceRaw);
    const stock = Number(stockRaw);

    if (!sku) rowErrors.push('sku es requerido');
    else if (sku.length > 50) rowErrors.push('sku no puede exceder 50 caracteres');
    else if (!SKU_RE.test(sku)) rowErrors.push('sku solo admite letras, números, guiones y guiones bajos');

    if (!name) rowErrors.push('name es requerido');
    else if (name.length > 200) rowErrors.push('name no puede exceder 200 caracteres');

    if (!description) rowErrors.push('description es requerida');
    else if (description.length > 1000) rowErrors.push('description no puede exceder 1000 caracteres');

    if (priceRaw === '' || !Number.isFinite(price)) rowErrors.push('price debe ser un número');
    else if (price < 0) rowErrors.push('price no puede ser negativo');

    if (stockRaw === '' || !Number.isFinite(stock)) rowErrors.push('stock debe ser un número');
    else if (!Number.isInteger(stock) || stock < 0) rowErrors.push('stock debe ser un entero no negativo');

    if (!category) rowErrors.push('category es requerida');
    else if (category.length > 100) rowErrors.push('category no puede exceder 100 caracteres');

    if (imageUrl && !isValidUrl(imageUrl)) rowErrors.push('imageUrl no es una URL válida');

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, errors: rowErrors });
      continue;
    }

    if (bySku.has(sku)) {
      warnings.push(
        `SKU ${sku} duplicado (filas ${firstRowOfSku.get(sku)} y ${rowNumber}); se usa la fila ${rowNumber}`
      );
    } else {
      firstRowOfSku.set(sku, rowNumber);
    }

    bySku.set(sku, {
      row: rowNumber,
      sku,
      name,
      description,
      price,
      stock,
      category,
      ...(imageUrl && { imageUrl })
    });
  }

  return { rows: Array.from(bySku.values()), errors, warnings };
}

export interface PreviewRow {
  row: number;
  action: 'create' | 'update';
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export interface PreviewResult {
  summary: { total: number; toCreate: number; toUpdate: number; invalid: number };
  rows: PreviewRow[];
  errors: RowError[];
  warnings: string[];
}

export interface ImportResult {
  summary: { created: number; updated: number; invalid: number };
  errors: RowError[];
  warnings: string[];
}

/** Compara filas parseadas contra la DB y clasifica en create/update. */
export async function buildPreview(parse: ParseResult): Promise<PreviewResult> {
  const skus = parse.rows.map((r) => r.sku);
  const existing = await Product.find({ sku: { $in: skus } }).select('sku').lean();
  const existingSkus = new Set(existing.map((p) => p.sku));

  const rows: PreviewRow[] = parse.rows.map((r) => ({
    row: r.row,
    action: existingSkus.has(r.sku) ? 'update' : 'create',
    sku: r.sku,
    name: r.name,
    price: r.price,
    stock: r.stock
  }));

  const toUpdate = rows.filter((r) => r.action === 'update').length;

  return {
    summary: {
      total: parse.rows.length + parse.errors.length,
      toCreate: rows.length - toUpdate,
      toUpdate,
      invalid: parse.errors.length
    },
    rows,
    errors: parse.errors,
    warnings: parse.warnings
  };
}

/**
 * Upsert por SKU con bulkWrite. La validación ya ocurrió en parseCatalog
 * (bulkWrite no ejecuta validators ni hooks de Mongoose).
 */
export async function executeImport(parse: ParseResult): Promise<ImportResult> {
  if (parse.rows.length === 0) {
    throw new ImportError('Nada para importar: no hay filas válidas en el Excel');
  }

  const operations = parse.rows.map((r) => ({
    updateOne: {
      filter: { sku: r.sku },
      update: {
        $set: {
          name: r.name,
          description: r.description,
          price: r.price,
          stock: r.stock,
          category: r.category,
          ...(r.imageUrl !== undefined && { imageUrl: r.imageUrl })
        },
        $setOnInsert: { isActive: true }
      },
      upsert: true
    }
  }));

  const result = await Product.bulkWrite(operations, { ordered: false });

  return {
    summary: {
      created: result.upsertedCount,
      updated: result.matchedCount,
      invalid: parse.errors.length
    },
    errors: parse.errors,
    warnings: parse.warnings
  };
}
