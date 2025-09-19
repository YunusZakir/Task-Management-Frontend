// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { enableProdMode } from '@angular/core';

// Enable production mode if needed
// enableProdMode();

// Verify token is in localStorage
console.log('Token in localStorage:', localStorage.getItem('accessToken'));

// Bootstrap the application
bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error('Bootstrap error:', err));