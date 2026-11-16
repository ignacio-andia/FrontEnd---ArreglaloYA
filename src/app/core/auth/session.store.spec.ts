import { TestBed } from '@angular/core/testing';
import { AuthResponse } from './auth.models';
import { SessionStore } from './session.store';

const TOKEN_STORAGE_KEY = 'servicios-hogar.access-token';

const authResponse: AuthResponse = {
  accessToken: 'jwt-token',
  tokenType: 'Bearer',
  user: {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles: ['CLIENTE'],
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  },
};

describe('SessionStore', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  describe('initialization', () => {
    it('starts without session when sessionStorage has no token', () => {
      const store = TestBed.inject(SessionStore);

      expect(store.token()).toBeNull();
      expect(store.user()).toBeNull();
      expect(store.hasToken()).toBe(false);
      expect(store.isAuthenticated()).toBe(false);
    });

    it('restores the token from sessionStorage without a user', () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');

      const store = TestBed.inject(SessionStore);

      expect(store.token()).toBe('stored-token');
      expect(store.hasToken()).toBe(true);
      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
    });

    it('ignores an empty stored token', () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, '');

      expect(TestBed.inject(SessionStore).token()).toBeNull();
    });
  });

  describe('setSession', () => {
    it('keeps token and user in memory and persists only the token', () => {
      const store = TestBed.inject(SessionStore);

      store.setSession(authResponse);

      expect(store.token()).toBe('jwt-token');
      expect(store.user()).toEqual(authResponse.user);
      expect(store.isAuthenticated()).toBe(true);
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-token');
      expect(sessionStorage.length).toBe(1);
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('authenticates a restored token once the user is set', () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
      const store = TestBed.inject(SessionStore);

      store.setUser(authResponse.user);

      expect(store.token()).toBe('stored-token');
      expect(store.isAuthenticated()).toBe(true);
    });
  });

  describe('clear', () => {
    it('removes token and user from memory and sessionStorage', () => {
      const store = TestBed.inject(SessionStore);
      store.setSession(authResponse);

      store.clear();

      expect(store.token()).toBeNull();
      expect(store.user()).toBeNull();
      expect(store.hasToken()).toBe(false);
      expect(store.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});
