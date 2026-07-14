import { redactSecrets, safeStringify } from './redact';

describe('secret redaction', () => {
  it('masks sensitive keys at any depth', () => {
    const out: any = redactSecrets({
      email: 'a@b.com',
      password: 'hunter2',
      access_token: 'xyz',
      refresh_token: 'rrr',
      partner_key: 'shpk_live',
      api_key: 'k',
      authorization: 'Bearer abc',
      nested: { secret: 's', qty: 5, name: 'ok' },
    });
    expect(out.email).toBe('a@b.com');
    expect(out.password).toBe('«redacted»');
    expect(out.access_token).toBe('«redacted»');
    expect(out.refresh_token).toBe('«redacted»');
    expect(out.partner_key).toBe('«redacted»');
    expect(out.api_key).toBe('«redacted»');
    expect(out.authorization).toBe('«redacted»');
    expect(out.nested.secret).toBe('«redacted»');
    expect(out.nested.qty).toBe(5);
    expect(out.nested.name).toBe('ok');
  });

  it('masks non-suffix sensitive key names (substring / camelCase / snake)', () => {
    const out: any = redactSecrets({
      secretKey: 's',
      tokenId: 't',
      client_secret: 'c',
      apiKeyValue: 'a',
      secretRef: 'v1:...',
      tokenHash: 'h',
      shipping: 'Giao hàng nhanh', // must NOT be masked (contains "pin"? no; ensure not over-masked)
      design: 'flat', // must NOT be masked (contains "sign")
    });
    expect(out.secretKey).toBe('«redacted»');
    expect(out.tokenId).toBe('«redacted»');
    expect(out.client_secret).toBe('«redacted»');
    expect(out.apiKeyValue).toBe('«redacted»');
    expect(out.secretRef).toBe('«redacted»');
    expect(out.tokenHash).toBe('«redacted»');
    expect(out.shipping).toBe('Giao hàng nhanh');
    expect(out.design).toBe('flat');
  });

  it('masks token-shaped values even under a benign key', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36';
    const out: any = redactSecrets({ note: jwt, hex: 'a'.repeat(48), normal: 'hello world' });
    expect(out.note).toBe('«redacted»');
    expect(out.hex).toBe('«redacted»');
    expect(out.normal).toBe('hello world');
  });

  it('masks credentials embedded in a URL / connection string', () => {
    const out: any = redactSecrets({
      DATABASE_URL: 'postgresql://appuser:S3cretPass@db-host:5432/app',
      site: 'https://example.com/path?x=1',
    });
    expect(out.DATABASE_URL).toBe('postgresql://appuser:«redacted»@db-host:5432/app');
    expect(out.DATABASE_URL).not.toContain('S3cretPass');
    expect(out.site).toBe('https://example.com/path?x=1'); // no userinfo → untouched
  });

  it('handles arrays and does not mutate input', () => {
    const input = { list: [{ token: 't1' }, { ok: 1 }] };
    const out: any = redactSecrets(input);
    expect(out.list[0].token).toBe('«redacted»');
    expect(out.list[1].ok).toBe(1);
    expect(input.list[0].token).toBe('t1'); // original untouched
  });

  it('safeStringify never throws and redacts', () => {
    const s = safeStringify({ password: 'p', a: 1 });
    expect(s).toContain('«redacted»');
    expect(s).not.toContain('"p"');
  });
});
