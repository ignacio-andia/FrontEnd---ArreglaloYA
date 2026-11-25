import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { ClientLayoutComponent } from './layouts/client-layout/client-layout.component';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { WorkerLayoutComponent } from './layouts/worker-layout/worker-layout.component';

/**
 * Árbol principal de rutas. Cada área usa su layout y tiene una página de inicio; las features
 * se montan como hijas con `loadComponent`/`loadChildren`. Las secciones previstas sin página se
 * muestran como "Próximamente" en la navegación y no tienen ruta.
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
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/pages/public-home-page/public-home-page.component').then(
            (m) => m.PublicHomePageComponent,
          ),
      },
      {
        path: 'como-funciona',
        title: 'Cómo funciona | ArreglaloYA',
        loadComponent: () =>
          import('./features/home/pages/how-it-works-page/how-it-works-page.component').then(
            (m) => m.HowItWorksPageComponent,
          ),
      },
      {
        path: 'acceso-denegado',
        title: 'Acceso no permitido | ArreglaloYA',
        loadComponent: () =>
          import('./features/home/pages/access-denied-page/access-denied-page.component').then(
            (m) => m.AccessDeniedPageComponent,
          ),
      },
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
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/pages/client-home-page/client-home-page.component').then(
            (m) => m.ClientHomePageComponent,
          ),
      },
      {
        path: 'mi-cuenta',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: 'mis-pedidos',
        loadChildren: () =>
          import('./features/orders/orders.routes').then((m) => m.MY_ORDERS_ROUTES),
      },
      {
        path: 'publicar-pedido',
        loadChildren: () =>
          import('./features/orders/orders.routes').then((m) => m.PUBLISH_ORDER_ROUTES),
      },
      {
        path: 'ofertas',
        loadChildren: () =>
          import('./features/offers/offers.routes').then((m) => m.RECEIVED_OFFERS_ROUTES),
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
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/pages/worker-home-page/worker-home-page.component').then(
            (m) => m.WorkerHomePageComponent,
          ),
      },
      {
        path: 'mi-cuenta',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: 'pedidos',
        loadChildren: () =>
          import('./features/offers/offers.routes').then((m) => m.AVAILABLE_ORDERS_ROUTES),
      },
      {
        path: 'ofertas',
        loadChildren: () =>
          import('./features/offers/offers.routes').then((m) => m.OWN_OFFERS_ROUTES),
      },
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
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/pages/admin-home-page/admin-home-page.component').then(
            (m) => m.AdminHomePageComponent,
          ),
      },
      {
        path: 'mi-cuenta',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.ACCOUNT_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
