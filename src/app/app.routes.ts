import { Routes } from '@angular/router';
import { BoardComponent } from './features/board/board/board.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'board', component: BoardComponent, canActivate: [authGuard] },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/auth/accept-invite/accept-invite.component').then(
        (m) => m.AcceptInviteComponent,
      ),
  },
];
