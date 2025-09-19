import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  private themeSubject: BehaviorSubject<Theme>;
  
  public theme$: Observable<Theme>;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    const initialTheme = this.getInitialTheme();
    console.log('ThemeService: Initializing with theme:', initialTheme);
    this.themeSubject = new BehaviorSubject<Theme>(initialTheme);
    this.theme$ = this.themeSubject.asObservable();
    
    // Apply theme after a short delay to ensure DOM is ready
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.applyTheme(initialTheme), 0);
    }
  }

  private getInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light'; // Default to light theme on server
    }

    // Check localStorage first
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  public toggleTheme(): void {
    const currentTheme = this.themeSubject.value;
    const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';
    console.log('ThemeService: Toggling from', currentTheme, 'to', newTheme);
    this.setTheme(newTheme);
  }

  public setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.THEME_KEY, theme);
    }
    this.applyTheme(theme);
  }

  public getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  private applyTheme(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('ThemeService: Skipping theme application on server');
      return; // Skip DOM manipulation on server
    }

    console.log('ThemeService: Applying theme', theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Also add class for easier CSS targeting
    root.classList.remove('light-theme', 'dark-theme');
    root.classList.add(`${theme}-theme`);
    console.log('ThemeService: Theme applied, root classes:', root.className);
  }
}
