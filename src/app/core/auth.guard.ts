import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // ✅ Only access localStorage if window is defined
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  if (token) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};
