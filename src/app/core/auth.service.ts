import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  async login(email: string, password: string) {
    try {
      const res = await this.api.login({ email, password }).toPromise();
      if (res) {
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        await this.router.navigateByUrl('/board');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async acceptInvite(token: string, name: string | undefined, password: string) {
    try {
      const res = await this.api.acceptInvite({ token, name, password }).toPromise();
      if (res) {
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        await this.router.navigateByUrl('/board');
      }
    } catch (error) {
      console.error('Accept invite error:', error);
      throw error;
    }
  }

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    this.router.navigateByUrl('/login');
  }
}
