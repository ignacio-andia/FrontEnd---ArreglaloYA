import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { ClientLayoutComponent } from './layouts/client-layout/client-layout.component';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { WorkerLayoutComponent } from './layouts/worker-layout/worker-layout.component';

/**
 * Árbol principal de rutas. Cada área usa su layout; las features se añadirán como hijas
 * con `loadComponent`/`loadChildren`. Las áreas no tienen todavía páginas hijas: las secciones
 * previstas se muestran como "Próximamente" en la navegación y no tienen ruta.
 *
 * Cada área define un `title` (las páginas hijas lo reemplazan con el suyo), para que el título
 * de la pestaña no conserve el de la página anterior.
 *
 * Una cuenta puede tener a la vez CLIENTE y TRABAJADOR: cada área solo exige su propio rol.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'ArreglaloYA',
    component: PublicLayoutComponent,
    children: [
      {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
      },
      {
        path: 'categorias',
        loadChildren: () =>
          import('./features/catalogs/catalogs.routes').then((m) => m.CATALOGS_ROUTES),
      },
    ],
  },
  {
    path: 'cliente',
    title: 'Área de cliente | ArreglaloYA',
    component: ClientLayoutComponent,
    canActivate: [authGuard, roleGuard(['CLIENTE'])],
    children: [
      {
        path: 'mi-cuenta',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: 'publicar-pedido',
        loadChildren: () =>
          import('./features/orders/orders.routes').then((m) => m.PUBLISH_ORDER_ROUTES),
      },
      {
        path: 'ofrecer-servicios',
        loadChildren: () =>
          import('./features/worker-profile/worker-profile.routes').then(
            (m) => m.BECOME_WORKER_ROUTES,
          ),
      },
    ],
  },
  {
    path: 'trabajador',
    title: 'Área de trabajador | ArreglaloYA',
    component: WorkerLayoutComponent,
    // El área exige el rol, no el perfil aprobado: las páginas que requieran aprobación
    // (por ejemplo, solicitudes disponibles) añadirán `canActivate: [approvedWorkerGuard]`
    // en su propia ruta hija. La raíz `/trabajador` nunca debe llevarlo (destino del guard).
    canActivate: [authGuard, roleGuard(['TRABAJADOR'])],
    children: [
      {
        path: 'perfil',
        loadChildren: () =>
          import('./features/worker-profile/worker-profile.routes').then(
            (m) => m.WORKER_PROFILE_ROUTES,
          ),
      },
    ],
  },
  {
    path: 'admin',
    title: 'Administración | ArreglaloYA',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard(['ADMINISTRADOR'])],
    children: [],
  },
  { path: '**', redirectTo: '' },
];
