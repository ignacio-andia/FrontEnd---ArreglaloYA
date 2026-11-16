import { homePathForRoles, isAuthAreaUrl, safeReturnUrl } from './auth-navigation';

describe('auth navigation', () => {
  describe('homePathForRoles', () => {
    it.each([
      [['CLIENTE'], '/cliente'],
      [['TRABAJADOR'], '/trabajador'],
      [['ADMINISTRADOR'], '/admin'],
      [['CLIENTE', 'TRABAJADOR'], '/trabajador'],
      [['TRABAJADOR', 'CLIENTE'], '/trabajador'],
      [['CLIENTE', 'ADMINISTRADOR'], '/admin'],
      [['CLIENTE', 'TRABAJADOR', 'ADMINISTRADOR'], '/admin'],
    ] as const)('sends %j to %s (ADMINISTRADOR > TRABAJADOR > CLIENTE)', (roles, path) => {
      expect(homePathForRoles(roles)).toBe(path);
    });

    it('falls back to the public home without roles', () => {
      expect(homePathForRoles([])).toBe('/');
    });
  });

  describe('isAuthAreaUrl', () => {
    it.each(['/auth', '/auth/login', '/auth/registro?x=1', '/auth#top'])('detects %s', (url) => {
      expect(isAuthAreaUrl(url)).toBe(true);
    });

    it.each(['/', '/cliente', '/authx', '/cliente/auth'])('ignores %s', (url) => {
      expect(isAuthAreaUrl(url)).toBe(false);
    });
  });

  describe('safeReturnUrl', () => {
    it.each([
      ['/cliente', '/cliente'],
      ['/cliente/pedidos?status=PUBLICADO&page=2', '/cliente/pedidos?status=PUBLICADO&page=2'],
      ['/trabajador#perfil', '/trabajador#perfil'],
      ['/admin/../cliente', '/cliente'],
    ])('accepts the internal path %s', (value, expected) => {
      expect(safeReturnUrl(value)).toBe(expected);
    });

    it.each([
      null,
      undefined,
      '',
      'cliente',
      'https://malicioso.example.com',
      'http://localhost:4200/cliente',
      '//malicioso.example.com',
      '/\\malicioso.example.com',
      '/\\/malicioso.example.com',
      'javascript:alert(1)',
      '/cliente\nSet-Cookie',
      '/auth/login',
      '/auth/registro?returnUrl=%2Fcliente',
    ])('rejects %j', (value) => {
      expect(safeReturnUrl(value)).toBeNull();
    });
  });
});
