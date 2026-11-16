import { environment } from '../../../environments/environment';
import { API_BASE_URL, apiUrl } from './api-url';

describe('apiUrl', () => {
  it('uses environment.apiBaseUrl as base', () => {
    expect(API_BASE_URL).toBe(environment.apiBaseUrl);
    expect(apiUrl()).toBe(environment.apiBaseUrl);
  });

  it('joins path segments without duplicating the /api prefix', () => {
    expect(apiUrl('auth', 'me')).toBe(`${environment.apiBaseUrl}/auth/me`);
    expect(apiUrl('orders', 'me', '7b0c2f4e-1d2a-4c3b-9e8f-0a1b2c3d4e5f')).toBe(
      `${environment.apiBaseUrl}/orders/me/7b0c2f4e-1d2a-4c3b-9e8f-0a1b2c3d4e5f`,
    );
  });

  it('encodes each segment', () => {
    expect(apiUrl('orders', 'a/b?c')).toBe(`${environment.apiBaseUrl}/orders/a%2Fb%3Fc`);
  });

  it('rejects empty segments', () => {
    expect(() => apiUrl('orders', 'me', '')).toThrowError();
  });
});
