import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  email = '';
  password = '';
  error = '';
  loading = false;

  async submit() {
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password';
      return;
    }

    this.loading = true;
    this.error = '';
    
    try {
      console.log('Attempting login with:', { email: this.email, password: '***' });
      await this.auth.login(this.email, this.password);
      console.log('Login successful');
    } catch (error: any) {
      console.error('Login failed:', error);
      this.error = error?.error?.message || error?.message || 'Login failed. Please check your credentials.';
    } finally {
      this.loading = false;
    }
  }
}
