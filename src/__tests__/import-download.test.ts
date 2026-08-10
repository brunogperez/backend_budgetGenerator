import { downloadDriveFile, ImportError } from '../services/import.service';

const DRIVE_URL = 'https://drive.google.com/file/d/FILE123/view';

function mockFetchResponse(options: {
  ok?: boolean;
  contentType?: string;
  body?: Buffer;
}): void {
  const { ok = true, contentType = 'application/octet-stream', body = Buffer.from('data') } = options;
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
  });
}

describe('downloadDriveFile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('descarga y devuelve Buffer', async () => {
    mockFetchResponse({ body: Buffer.from('contenido-xlsx') });
    const buf = await downloadDriveFile(DRIVE_URL);

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('contenido-xlsx');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://drive.google.com/uc?export=download&id=FILE123',
      expect.objectContaining({ redirect: 'follow' })
    );
  });

  it('rechaza respuesta HTTP no-ok', async () => {
    mockFetchResponse({ ok: false });
    await expect(downloadDriveFile(DRIVE_URL)).rejects.toThrow(ImportError);
  });

  it('rechaza respuesta HTML (archivo no público)', async () => {
    mockFetchResponse({ contentType: 'text/html; charset=utf-8' });
    await expect(downloadDriveFile(DRIVE_URL)).rejects.toThrow(/públic/);
  });

  it('rechaza archivo mayor a 10 MB', async () => {
    mockFetchResponse({ body: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await expect(downloadDriveFile(DRIVE_URL)).rejects.toThrow(/10 MB/);
  });

  it('rechaza cuerpo vacío', async () => {
    mockFetchResponse({ body: Buffer.alloc(0) });
    await expect(downloadDriveFile(DRIVE_URL)).rejects.toThrow(ImportError);
  });

  it('convierte timeout en ImportError', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'TimeoutError';
    global.fetch = jest.fn().mockRejectedValue(abortError);
    await expect(downloadDriveFile(DRIVE_URL)).rejects.toThrow(/Tiempo de espera/);
  });

  it('convierte error de red en ImportError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(downloadDriveFile(DRIVE_URL)).rejects.toThrow(ImportError);
  });
});
