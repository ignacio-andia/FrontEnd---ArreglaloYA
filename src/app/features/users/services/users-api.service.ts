import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../../../core/auth/auth.models';
import { apiUrl } from '../../../core/http/api-url';
import { UpdateUserRequest, UpdateUserStatusRequest } from '../models/user-account.model';

/**
 * Servicio API de cuentas (`/api/users`). La consulta de la cuenta propia se hace con
 * `AuthService.getCurrentUser()` (`GET /auth/me`); aquí solo está la actualización.
 * La administración de usuarios (listado y estado de otras cuentas) no forma parte de este
 * servicio.
 */
@Service()
export class UsersApiService {
  private readonly http = inject(HttpClient);

  /**
   * `PATCH /users/:id` (la propia cuenta o un administrador). Devuelve el `PublicUser`
   * completo y actualizado. Envía solo las propiedades del DTO que vienen definidas.
   */
  updateUser(id: string, request: UpdateUserRequest): Observable<User> {
    const body: UpdateUserRequest = {};
    if (request.firstName !== undefined) {
      body.firstName = request.firstName;
    }
    if (request.lastName !== undefined) {
      body.lastName = request.lastName;
    }
    if (request.phone !== undefined) {
      body.phone = request.phone;
    }

    return this.http.patch<User>(apiUrl('users', id), body);
  }

  /**
   * `PATCH /users/:id/status` con `INACTIVO` sobre la propia cuenta. La cuenta ya no puede iniciar
   * sesión y solo un administrador la reactiva. 409 si es el único administrador activo.
   */
  deactivateOwnAccount(id: string): Observable<User> {
    const body: UpdateUserStatusRequest = { status: 'INACTIVO' };
    return this.http.patch<User>(apiUrl('users', id, 'status'), body);
  }
}
