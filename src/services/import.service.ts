/**
 * Servicio de importación de catálogo desde Excel de Google Drive.
 * Pipeline: normalizar URL → descargar → parsear → validar → upsert por SKU.
 */

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
