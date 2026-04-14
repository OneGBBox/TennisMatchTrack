import { Component } from '@angular/core';

@Component({
  selector: 'app-match-list',
  template: `
    <div class="page">
      <header class="page-header">
        <h1>Matches</h1>
      </header>
      <div class="page-content">
        <p class="placeholder-text">Match list coming soon...</p>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      padding: var(--space-4) var(--space-4) 0;
    }
    .page-header h1 {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .placeholder-text {
      color: var(--color-text-muted);
      text-align: center;
      margin-top: var(--space-10);
    }
  `]
})
export class MatchListComponent {}
