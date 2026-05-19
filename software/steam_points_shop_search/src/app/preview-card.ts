import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import {
  RewardDefinition,
  buildAssetUrl,
  rewardClassLabel,
  rewardPreviewImageFile,
  rewardVideoFile,
  rewardTitle,
} from './reward.model';

@Component({
  selector: 'app-preview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item(); as it) {
      <article class="card">
        <div class="frame">
          @if (videoUrl(); as v) {
            <video [src]="v" autoplay loop [muted]="muted()" playsinline></video>
          } @else if (imageUrl(); as i) {
            <img [src]="i" [alt]="title()">
          } @else {
            <div class="empty">NO · PREVIEW</div>
          }
          <span class="corner corner--tl"></span>
          <span class="corner corner--tr"></span>
          <span class="corner corner--bl"></span>
          <span class="corner corner--br"></span>
          <span class="bar" [title]="appLabel()">REC&nbsp;·&nbsp;{{ appLabel() }}</span>
        </div>
        <div class="body">
          <p class="meta">{{ classLabel() }}</p>
          <h2>{{ title() }}</h2>
          @if (it.community_item_data?.item_description; as d) {
            <p class="desc">{{ d }}</p>
          }
        </div>
        <dl class="stats">
          <div><dt>cost</dt><dd>{{ it.point_cost }}<em>p</em></dd></div>
          <div><dt>app</dt><dd [title]="appLabel()">{{ appLabel() }}</dd></div>
        </dl>
      </article>
    }
  `,
  styles: `
    :host { display: block; }

    .card {
      background: rgba(15, 15, 13, 0.96);
      backdrop-filter: blur(14px);
      border: 1px solid var(--border-hi);
      box-shadow:
        0 30px 80px -20px rgba(0, 0, 0, 0.9),
        0 0 0 1px rgba(182, 255, 90, 0.08),
        inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    }

    .frame {
      position: relative;
      aspect-ratio: 4 / 3;
      background:
        radial-gradient(ellipse at center, var(--surface-2), var(--surface));
      overflow: hidden;
      border-bottom: 1px solid var(--border);
    }

    .frame img,
    .frame video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.35em;
      color: var(--dim);
    }

    .corner {
      position: absolute;
      width: 14px; height: 14px;
      border: 1px solid var(--accent);
      pointer-events: none;
    }
    .corner--tl { top: 8px; left: 8px;  border-right: 0; border-bottom: 0; }
    .corner--tr { top: 8px; right: 8px; border-left: 0;  border-bottom: 0; }
    .corner--bl { bottom: 8px; left: 8px;  border-right: 0; border-top: 0; }
    .corner--br { bottom: 8px; right: 8px; border-left: 0;  border-top: 0; }

    .bar {
      position: absolute;
      left: 10px; right: 10px; bottom: 10px;
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.18em;
      color: var(--accent);
      background: rgba(10, 10, 9, 0.7);
      padding: 3px 6px;
      border: 1px solid var(--border);
      width: fit-content;
      max-width: calc(100% - 20px);
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .body { padding: 18px 18px 14px; }

    .meta {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.22em;
      color: var(--accent-2);
      margin: 0 0 8px;
      text-transform: uppercase;
    }

    h2 {
      font-family: var(--serif);
      font-weight: 300;
      font-style: italic;
      font-size: 28px;
      line-height: 1.02;
      letter-spacing: -0.018em;
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
    }

    .desc {
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.55;
      color: var(--muted);
      margin: 12px 0 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .stats {
      display: grid;
      grid-template-columns: minmax(54px, 0.65fr) minmax(0, 1.9fr);
      gap: 1px;
      margin: 0;
      background: var(--border);
      border-top: 1px solid var(--border);
    }

    .stats > div {
      background: var(--surface);
      padding: 10px 14px;
      margin: 0;
      min-width: 0;
    }

    dt {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.22em;
      color: var(--dim);
      text-transform: uppercase;
      margin: 0 0 4px;
    }

    dd {
      margin: 0;
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      min-width: 0;
      overflow-wrap: anywhere;
      white-space: normal;

      em {
        font-style: normal;
        color: var(--dim);
        font-size: 10px;
        margin-left: 2px;
      }
    }
  `,
})
export class PreviewCard {
  item = input.required<RewardDefinition | null>();
  appName = input<string>('Unknown app');
  muted = input<boolean>(true);

  title = computed(() => {
    const it = this.item();
    return it ? rewardTitle(it) : '';
  });

  classLabel = computed(() => {
    const it = this.item();
    return it ? rewardClassLabel(it.community_item_class) : '';
  });

  appLabel = computed(() => this.appName());

  imageUrl = computed(() => {
    const it = this.item();
    if (!it) return null;
    return buildAssetUrl(it.appid, rewardPreviewImageFile(it));
  });

  videoUrl = computed(() => {
    const it = this.item();
    if (!it) return null;
    return buildAssetUrl(it.appid, rewardVideoFile(it));
  });
}
