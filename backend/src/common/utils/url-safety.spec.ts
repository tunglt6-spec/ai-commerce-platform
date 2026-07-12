import { assertSafeExternalUrl, isPrivateAddress, isSafeExternalUrl } from './url-safety';

describe('SSRF url-safety guard', () => {
  describe('isPrivateAddress', () => {
    it.each(['127.0.0.1', '10.0.0.5', '192.168.1.10', '172.16.0.1', '172.31.255.255', '169.254.169.254', '0.0.0.0', '100.64.0.1'])(
      'blocks private/loopback/link-local IPv4 %s',
      (ip) => expect(isPrivateAddress(ip)).toBe(true),
    );
    it.each(['8.8.8.8', '1.1.1.1', '203.0.113.10'])('allows public IPv4 %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
    it.each(['::1', 'fe80::1', 'fd00::1', 'fc00::abcd'])('blocks loopback/link-local/ULA IPv6 %s', (ip) =>
      expect(isPrivateAddress(ip)).toBe(true),
    );
    it('blocks IPv4-mapped IPv6 to a private v4 (dotted form)', () => expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true));
    it.each([
      '::ffff:7f00:1', // ::ffff:127.0.0.1 — hex form the URL parser produces
      '::ffff:a9fe:a9fe', // ::ffff:169.254.169.254 — cloud metadata
      '::7f00:1', // ::127.0.0.1 IPv4-compatible
      '::ffff:c0a8:1', // ::ffff:192.168.0.1
    ])('blocks IPv4-mapped/compat IPv6 in HEX form %s', (ip) => expect(isPrivateAddress(ip)).toBe(true));
    it('allows a mapped PUBLIC v4 in hex form', () => expect(isPrivateAddress('::ffff:0808:0808')).toBe(false)); // 8.8.8.8
  });

  describe('assertSafeExternalUrl (no DNS needed for these)', () => {
    it('rejects non-http(s) schemes', async () => {
      await expect(assertSafeExternalUrl('ftp://example.com')).rejects.toThrow('SSRF_BLOCKED');
      await expect(assertSafeExternalUrl('file:///etc/passwd')).rejects.toThrow('SSRF_BLOCKED');
    });
    it('rejects credentials in the URL', async () => {
      await expect(assertSafeExternalUrl('http://user:pass@example.com')).rejects.toThrow('SSRF_BLOCKED');
    });
    it('rejects loopback / metadata / private IP literals', async () => {
      await expect(assertSafeExternalUrl('http://127.0.0.1/')).rejects.toThrow('SSRF_BLOCKED');
      await expect(assertSafeExternalUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow('SSRF_BLOCKED');
      await expect(assertSafeExternalUrl('http://192.168.0.5:8080/x')).rejects.toThrow('SSRF_BLOCKED');
    });
    it('rejects localhost and *.internal by name', async () => {
      await expect(assertSafeExternalUrl('http://localhost/')).rejects.toThrow('SSRF_BLOCKED');
      await expect(assertSafeExternalUrl('http://foo.internal/')).rejects.toThrow('SSRF_BLOCKED');
    });
    it('allows a public IP-literal https URL', async () => {
      await expect(assertSafeExternalUrl('https://8.8.8.8/health')).resolves.toBeUndefined();
    });
    it('isSafeExternalUrl returns boolean', async () => {
      expect(await isSafeExternalUrl('http://127.0.0.1')).toBe(false);
      expect(await isSafeExternalUrl('https://1.1.1.1')).toBe(true);
    });

    it('honors SSRF_ALLOWED_HOSTS allow-list (empty in prod) but still enforces scheme/credentials', async () => {
      const prev = process.env.SSRF_ALLOWED_HOSTS;
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1,localhost';
      try {
        await expect(assertSafeExternalUrl('http://127.0.0.1:9999/verify')).resolves.toBeUndefined();
        await expect(assertSafeExternalUrl('http://localhost/webhook')).resolves.toBeUndefined();
        // Not on the list → still blocked.
        await expect(assertSafeExternalUrl('http://169.254.169.254/')).rejects.toThrow('SSRF_BLOCKED');
        // Scheme/credential checks apply even to allow-listed hosts.
        await expect(assertSafeExternalUrl('http://user:pass@127.0.0.1/')).rejects.toThrow('SSRF_BLOCKED');
      } finally {
        if (prev === undefined) delete process.env.SSRF_ALLOWED_HOSTS;
        else process.env.SSRF_ALLOWED_HOSTS = prev;
      }
    });
  });
});
