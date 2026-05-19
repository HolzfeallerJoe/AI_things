import { Component, ElementRef, Input, OnChanges, ViewChild, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-static-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas #canvas [class.hidden]="fallback()" [attr.aria-label]="alt" role="img"></canvas>
    @if (fallback()) {
      <img [src]="src" [alt]="alt" loading="lazy">
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    canvas,
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .hidden {
      display: none;
    }
  `,
})
export class StaticThumbnail implements OnChanges {
  @Input({ required: true }) src = '';
  @Input() alt = '';
  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;

  fallback = signal(false);
  private requestId = 0;

  ngOnChanges(): void {
    void this.drawStaticFrame();
  }

  private async drawStaticFrame(): Promise<void> {
    const src = this.src;
    const canvas = this.canvas?.nativeElement;
    const requestId = ++this.requestId;
    if (!src || !canvas || typeof fetch === 'undefined' || typeof createImageBitmap === 'undefined') {
      this.fallback.set(true);
      return;
    }

    try {
      this.fallback.set(false);
      const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`image request failed: ${response.status}`);

      const bitmap = await createImageBitmap(await response.blob());
      if (requestId !== this.requestId) {
        bitmap.close();
        return;
      }

      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas context unavailable');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
    } catch {
      if (requestId === this.requestId) this.fallback.set(true);
    }
  }
}
