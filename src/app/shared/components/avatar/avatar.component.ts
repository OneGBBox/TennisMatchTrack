import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div
      class="avatar"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="fontSize()"
      [style.background]="bgColor()"
    >
      @if (imageUrl()) {
        <img [src]="imageUrl()" [alt]="name()" />
      } @else {
        <span>{{ initials() }}</span>
      }
    </div>
  `,
  styles: [`
    .avatar {
      border-radius: 50%;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      letter-spacing: 0.5px;
      overflow: hidden;
      flex-shrink: 0;
      user-select: none;
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `]
})
export class AvatarComponent {
  name     = input<string>('');
  imageUrl = input<string | undefined>(undefined);
  size     = input<number>(36);

  initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  );

  fontSize = computed(() => Math.floor(this.size() * 0.38));

  /** Deterministic pastel colour derived from name string. */
  bgColor = computed(() => {
    const PALETTE = [
      '#007AFF', '#34C759', '#FF9500', '#FF3B30',
      '#AF52DE', '#5AC8FA', '#FF2D55', '#5856D6'
    ];
    let hash = 0;
    for (const ch of this.name()) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    return PALETTE[Math.abs(hash) % PALETTE.length];
  });
}
