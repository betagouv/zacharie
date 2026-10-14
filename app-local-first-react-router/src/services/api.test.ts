import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@app/utils/disconnect', () => ({ disconnect: vi.fn() }));

import API from './api';

describe('API.execute', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3234', pathname: '/', search: '' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renvoie le JSON du serveur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { a: 1 } }), { status: 200 }))
    );
    const res = await API.get({ path: '/test' });
    expect(res).toEqual({ ok: true, data: { a: 1 } });
  });

  it('renvoie une erreur quand le corps attendu en JSON est illisible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>proxy</html>', { status: 200 }))
    );
    const res = await API.get({ path: '/test' });
    expect(res).not.toBeInstanceOf(Response);
    expect(res.ok).toBe(false);
    expect(typeof (res as { error?: unknown }).error).toBe('string');
  });

  it('renvoie la Response brute pour un téléchargement de fichier', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('binary', { status: 200 }))
    );
    const res = await API.get({ path: '/test', headers: { Accept: 'application/zip' } });
    expect(res).toBeInstanceOf(Response);
  });
});
