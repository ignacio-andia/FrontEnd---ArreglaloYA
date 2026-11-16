import { NormalizedApiError } from '../../core/models/api-error.model';
import { apiErrorMessages, apiErrorStatus } from './api-error-message';

describe('api error message helpers', () => {
  const apiError: NormalizedApiError = {
    statusCode: 404,
    messages: ['Aún no tiene un perfil de trabajador'],
    error: 'Not Found',
  };

  it('reads a NormalizedApiError directly', () => {
    expect(apiErrorMessages(apiError, 'genérico')).toEqual([
      'Aún no tiene un perfil de trabajador',
    ]);
    expect(apiErrorStatus(apiError)).toBe(404);
  });

  it('reads a NormalizedApiError wrapped in cause (resource errors)', () => {
    const wrapped = new Error('wrapped', { cause: apiError });

    expect(apiErrorMessages(wrapped, 'genérico')).toEqual(['Aún no tiene un perfil de trabajador']);
    expect(apiErrorStatus(wrapped)).toBe(404);
  });

  it('falls back to the given message for unknown errors', () => {
    expect(apiErrorMessages(new Error('boom'), 'genérico')).toEqual(['genérico']);
    expect(apiErrorStatus(new Error('boom'))).toBeNull();
    expect(apiErrorStatus(undefined)).toBeNull();
  });
});
