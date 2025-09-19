import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../../services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss'
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  currentTheme: Theme = 'light';
  private themeSubscription?: Subscription;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    // Get initial theme immediately
    this.currentTheme = this.themeService.getCurrentTheme();
    
    this.themeSubscription = this.themeService.theme$.subscribe((theme: Theme) => {
      console.log('Theme changed to:', theme);
      this.currentTheme = theme;
    });
  }

  ngOnDestroy(): void {
    this.themeSubscription?.unsubscribe();
  }

  toggleTheme(): void {
    console.log('Toggle theme clicked, current theme:', this.currentTheme);
    this.themeService.toggleTheme();
    console.log('After toggle, new theme:', this.themeService.getCurrentTheme());
  }

  get isDarkMode(): boolean {
    return this.currentTheme === 'dark';
  }
}
