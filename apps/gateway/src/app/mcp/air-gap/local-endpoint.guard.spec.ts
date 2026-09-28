import {
  isLocalNetworkAddress,
  assertLocalVaultEndpoint,
  VaultAirGapError,
} from './local-endpoint.guard';

const resolveTo =
  (...addresses: string[]) =>
  async () =>
    addresses;

describe('the vault air gap', () => {
  describe('address classification', () => {
    it.each([
      ['127.0.0.1', 'ipv4 loopback'],
      ['127.1.2.3', 'the whole 127/8 loopback block'],
      ['10.4.2.9', 'rfc1918 10/8'],
      ['172.16.31.4', 'rfc1918 172.16/12 lower bound'],
      ['172.31.255.254', 'rfc1918 172.16/12 upper bound'],
      ['192.168.7.7', 'rfc1918 192.168/16'],
      ['169.254.10.1', 'link local, which is where a bare interface lives'],
      ['100.89.87.124', 'cgnat, which is the tailnet the on-prem box sits on'],
      ['::1', 'ipv6 loopback'],
      ['fd12:3456:789a::1', 'ipv6 unique local'],
      ['fe80::1', 'ipv6 link local'],
      ['::ffff:127.0.0.1', 'an ipv4-mapped loopback'],
    ])('treats %s as local (%s)', (address) => {
      expect(isLocalNetworkAddress(address)).toBe(true);
    });

    it.each([
      ['8.8.8.8', 'public resolver'],
      ['1.1.1.1', 'public resolver'],
      ['172.32.0.1', 'just past the 172.16/12 private block'],
      ['100.63.255.255', 'just below the cgnat block'],
      ['100.128.0.1', 'just above the cgnat block'],
      ['11.0.0.1', 'rfc1918 10/8 does not cover it'],
      ['2606:4700:4700::1111', 'public ipv6'],
      ['2001:4860:4860::8888', 'public ipv6 resolver'],
      ['0.0.0.0', 'the unspecified address is not a destination'],
      ['not-an-address', 'garbage is not local'],
    ])('refuses %s as non-local (%s)', (address) => {
      expect(isLocalNetworkAddress(address)).toBe(false);
    });
  });

  describe('endpoint acceptance', () => {
    it('accepts an unset-free local endpoint given as a full url', async () => {
      const url = await assertLocalVaultEndpoint(
        'http://127.0.0.1:11434',
        resolveTo('127.0.0.1')
      );

      expect(url.origin).toBe('http://127.0.0.1:11434');
    });

    it('accepts a bare host:port and normalises it to a url', async () => {
      const url = await assertLocalVaultEndpoint(
        'localhost:11434',
        resolveTo('127.0.0.1')
      );

      expect(url.origin).toBe('http://localhost:11434');
    });

    it('accepts a container-network name that resolves inside the cluster', async () => {
      const url = await assertLocalVaultEndpoint(
        'http://ollama:11434',
        resolveTo('10.6.0.3')
      );

      expect(url.host).toBe('ollama:11434');
    });
  });

  describe('refusal', () => {
    it('fails closed when nothing is configured', async () => {
      await expect(
        assertLocalVaultEndpoint(undefined, resolveTo('127.0.0.1'))
      ).rejects.toThrow(VaultAirGapError);
    });

    it('fails closed on an empty string rather than defaulting to a host', async () => {
      await expect(
        assertLocalVaultEndpoint('   ', resolveTo('127.0.0.1'))
      ).rejects.toThrow(/not configured/i);
    });

    it('refuses a public ip literal without asking dns', async () => {
      const resolve = jest.fn(resolveTo('8.8.8.8'));

      await expect(
        assertLocalVaultEndpoint('http://8.8.8.8:11434', resolve)
      ).rejects.toThrow(VaultAirGapError);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('refuses a public hostname whose addresses are public', async () => {
      await expect(
        assertLocalVaultEndpoint(
          'https://api.openai.com/v1',
          resolveTo('104.18.32.47')
        )
      ).rejects.toThrow(/air gap/i);
    });

    it('refuses when a hostname resolves to a mix of local and public', async () => {
      await expect(
        assertLocalVaultEndpoint(
          'http://rebind.example:11434',
          resolveTo('127.0.0.1', '52.14.7.9')
        )
      ).rejects.toThrow(VaultAirGapError);
    });

    it('refuses when dns returns nothing at all', async () => {
      await expect(
        assertLocalVaultEndpoint('http://nowhere.invalid:11434', async () => [])
      ).rejects.toThrow(/air gap/i);
    });

    it('refuses a non-http scheme so the prompt cannot leave over file:// or gopher://', async () => {
      await expect(
        assertLocalVaultEndpoint('file:///etc/passwd', resolveTo('127.0.0.1'))
      ).rejects.toThrow(/scheme/i);
    });

    it('refuses an endpoint carrying credentials', async () => {
      await expect(
        assertLocalVaultEndpoint(
          'http://user:pass@127.0.0.1:11434',
          resolveTo('127.0.0.1')
        )
      ).rejects.toThrow(/credentials/i);
    });

    it('refuses text that is not a url at all', async () => {
      await expect(
        assertLocalVaultEndpoint('http://[not a url', resolveTo('127.0.0.1'))
      ).rejects.toThrow(VaultAirGapError);
    });

    it('names the offending host so an operator can see what was refused', async () => {
      await expect(
        assertLocalVaultEndpoint(
          'https://generativelanguage.googleapis.com',
          resolveTo('142.250.72.14')
        )
      ).rejects.toThrow(/generativelanguage\.googleapis\.com/);
    });
  });
});
