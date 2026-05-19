import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  of,
  switchMap,
} from 'rxjs';

import { AppHit, PointsShopService, TopGame } from './points-shop.service';
import {
  RewardDefinition,
  buildAssetUrl,
  buildShopUrl,
  rewardClassLabel,
  rewardHasAnimation,
  rewardImageFile,
  rewardSmallVideoFile,
  rewardThumbnailFile,
  rewardTitle,
} from './reward.model';
import { PreviewCard } from './preview-card';
import { StaticThumbnail } from './static-thumbnail';

const FLOATER_W = 380;
const FLOATER_H = 460;
const FLOATER_MARGIN = 22;
const MAX_RENDERED_ROWS = 400;
const GLOBAL_REWARD_LIMIT = 1000;
const TOP_SELLING_LIMIT = 10;
const TOP_GAME_LIMIT = 10;
const TOP_GAME_SAMPLE_LIMIT = 1000;
const HIDDEN_CLASS_FILTERS = new Set([0]);

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PreviewCard, StaticThumbnail],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private shop = inject(PointsShopService);
  private destroyRef = inject(DestroyRef);
  private host = inject(ElementRef<HTMLElement>);

  readonly globalRewardLimit = GLOBAL_REWARD_LIMIT;
  readonly topSellingLimit = TOP_SELLING_LIMIT;
  readonly topGameLimit = TOP_GAME_LIMIT;

  // Names are learned from live Steam app search results and manually selected games.
  private appNames = new Map<number, string>([[730, 'Counter-Strike 2']]);
  private appNameVersion = signal(0);
  private activeRequest: Subscription | null = null;
  private activeOperation = 0;

  // -- Game picker (single-game mode) ---------------------------------------
  selectedGame = signal<{ appid: number; name: string }>({ appid: 730, name: 'Counter-Strike 2' });
  gamePickerInput = signal<string>('Counter-Strike 2');
  gameSuggestions = signal<AppHit[]>([]);
  gamePickerOpen = signal<boolean>(false);
  gameSearching = signal<boolean>(false);
  activeSuggestionIndex = signal<number>(-1);
  private pickerInput$ = new Subject<string>();

  // -- Item search & scoping ------------------------------------------------
  query = signal<string>('');
  selectedAppId = signal<number | null>(null);
  selectedClass = signal<number | null>(null);
  mode = signal<'single' | 'top' | 'global'>('top');

  // -- Results --------------------------------------------------------------
  items = signal<RewardDefinition[]>([]);
  topGames = signal<TopGame[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  scanProgress = signal<{ done: number; total: number }>({ done: 0, total: 0 });
  globalTotalCount = signal<number | null>(null);

  // -- UI -------------------------------------------------------------------
  hovered = signal<RewardDefinition | null>(null);
  cursor = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  resultsMinHeight = signal<number>(0);
  otherGamePrompt = signal<boolean>(false);
  soundMuted = signal<boolean>(true);

  constructor() {
    this.pickerInput$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((term) => {
          const t = term.trim();
          this.activeSuggestionIndex.set(-1);
          if (!t || /^\d+$/.test(t)) {
            this.gameSearching.set(false);
            this.gamePickerOpen.set(false);
            return of<AppHit[]>([]);
          }
          this.gameSearching.set(true);
          return this.shop.searchApps(t);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((hits) => {
        this.gameSearching.set(false);
        this.gameSuggestions.set(hits.slice(0, 8));
        this.gamePickerOpen.set(hits.length > 0);
        this.activeSuggestionIndex.set(hits.length > 0 ? 0 : -1);
      });
  }

  // -- Derived --------------------------------------------------------------

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const appid = this.selectedAppId();
    const cls = this.selectedClass();
    const matches = this.items().filter((it) => {
      if (appid != null && it.appid !== appid) return false;
      if (cls != null && it.community_item_class !== cls) return false;
      if (!q) return true;
      return this.itemSearchText(it).includes(q);
    });
    if (this.mode() === 'single' || this.mode() === 'top') return matches;

    return [...matches].sort((a, b) => {
      if (a.appid !== b.appid) return a.appid - b.appid;
      const classDiff = (a.community_item_class ?? 0) - (b.community_item_class ?? 0);
      if (classDiff !== 0) return classDiff;
      const titleDiff = rewardTitle(a).localeCompare(rewardTitle(b));
      if (titleDiff !== 0) return titleDiff;
      return a.defid - b.defid;
    });
  });

  visibleRows = computed(() => this.filtered().slice(0, MAX_RENDERED_ROWS));

  truncated = computed(() => this.filtered().length > MAX_RENDERED_ROWS);

  availableClasses = computed(() => {
    const set = new Set<number>();
    for (const it of this.items()) {
      if (it.community_item_class != null && !HIDDEN_CLASS_FILTERS.has(it.community_item_class)) {
        set.add(it.community_item_class);
      }
    }
    return [...set].sort((a, b) => a - b);
  });

  gamePickerMeta = computed(() => {
    this.appNameVersion();
    const raw = this.gamePickerInput().trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      const name = this.appNames.get(Number(raw));
      return name ? name : null;
    }

    const selected = this.selectedGame();
    if (selected.name.toLowerCase() === raw.toLowerCase()) {
      return String(selected.appid);
    }

    const activeSuggestion = this.gameSuggestions()[this.activeSuggestionIndex()]
      ?? this.gameSuggestions()[0];
    return activeSuggestion ? String(activeSuggestion.appid) : null;
  });

  // -- Lifecycle ------------------------------------------------------------

  ngOnInit(): void {
    this.loadTopSellingRewards();
  }

  // -- Game picker ----------------------------------------------------------

  onGamePickerInput(value: string): void {
    this.gamePickerInput.set(value);
    this.pickerInput$.next(value);
  }

  onGamePickerFocus(): void {
    if (this.gameSuggestions().length > 0) this.gamePickerOpen.set(true);
  }

  onGamePickerBlur(): void {
    // Defer close so click on a suggestion lands first.
    setTimeout(() => {
      this.gamePickerOpen.set(false);
      this.activeSuggestionIndex.set(-1);
    }, 160);
  }

  onGamePickerKeydown(ev: KeyboardEvent): void {
    const hits = this.gameSuggestions();
    if (ev.key === 'Escape') {
      this.gamePickerOpen.set(false);
      this.activeSuggestionIndex.set(-1);
      return;
    }
    if (!hits.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.gamePickerOpen.set(true);
      this.activeSuggestionIndex.update((idx) => (idx + 1) % hits.length);
      return;
    }

    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.gamePickerOpen.set(true);
      this.activeSuggestionIndex.update((idx) => (idx <= 0 ? hits.length - 1 : idx - 1));
      return;
    }

    if (ev.key === 'Enter' && this.gamePickerOpen()) {
      const active = this.activeSuggestionIndex();
      if (active >= 0 && hits[active]) {
        ev.preventDefault();
        this.pickGame(hits[active]);
      }
    }
  }

  submitGamePicker(): void {
    const raw = this.gamePickerInput().trim();
    if (!raw) return;

    if (/^\d+$/.test(raw)) {
      const id = Number(raw);
      const cachedName = this.appNames.get(id);
      if (cachedName) {
        this.pickAppId(id, cachedName);
        return;
      }
      this.gameSearching.set(true);
      this.shop.getAppName(id).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((name) => {
        this.gameSearching.set(false);
        this.pickAppId(id, name);
      });
      return;
    }
    const top = this.gameSuggestions()[0];
    if (top) this.pickGame(top);
  }

  pickGame(hit: AppHit): void {
    this.pickAppId(hit.appid, hit.name);
  }

  pickAppId(appid: number, name: string): void {
    this.rememberAppName(appid, name);
    this.selectedGame.set({ appid, name });
    this.gamePickerInput.set(name);
    this.gameSuggestions.set([]);
    this.gamePickerOpen.set(false);
    this.activeSuggestionIndex.set(-1);
    this.load();
  }

  // -- Loading --------------------------------------------------------------

  load(): void {
    const operation = this.startOperation();
    const id = this.selectedGame().appid;
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('invalid app id');
      this.loading.set(false);
      return;
    }
    this.mode.set('single');
    this.loading.set(true);
    this.error.set(null);
    this.otherGamePrompt.set(false);
    this.preserveResultsHeight();
    this.items.set([]);
    this.hovered.set(null);
    this.selectedAppId.set(null);
    this.selectedClass.set(null);
    this.scanProgress.set({ done: 0, total: 0 });
    this.globalTotalCount.set(null);

    this.activeRequest = this.shop.queryRewards(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.finishOperation(operation)),
    ).subscribe({
      next: (defs) => {
        if (!this.isActiveOperation(operation)) return;
        this.items.set(defs);
        this.rememberRewardAppNames(defs);
      },
      error: (e: { message?: string }) => {
        if (!this.isActiveOperation(operation)) return;
        this.error.set(e?.message ?? 'request failed');
      },
    });
  }

  loadTopSellingRewards(): void {
    const operation = this.startOperation();
    this.clearGamePicker();
    this.mode.set('top');
    this.loading.set(true);
    this.error.set(null);
    this.otherGamePrompt.set(false);
    this.preserveResultsHeight();
    this.items.set([]);
    this.topGames.set([]);
    this.hovered.set(null);
    this.selectedAppId.set(null);
    this.selectedClass.set(null);
    this.globalTotalCount.set(null);
    this.scanProgress.set({ done: 0, total: TOP_SELLING_LIMIT });

    this.activeRequest = forkJoin({
      rewards: this.shop.queryTopSellingRewards(TOP_SELLING_LIMIT),
      games: this.shop.queryTopGames(TOP_GAME_LIMIT, TOP_GAME_SAMPLE_LIMIT),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.finishOperation(operation)),
    ).subscribe({
      next: ({ rewards, games }) => {
        if (!this.isActiveOperation(operation)) return;
        this.items.set(rewards.items);
        this.rememberRewardAppNames(rewards.items);
        this.topGames.set(games);
        this.rememberTopGameNames(games);
        this.globalTotalCount.set(rewards.total);
        this.scanProgress.set({
          done: rewards.count,
          total: rewards.count || TOP_SELLING_LIMIT,
        });
      },
      error: (e: { message?: string }) => {
        if (!this.isActiveOperation(operation)) return;
        this.error.set(e?.message ?? 'top sellers request failed');
      },
    });
  }

  loadGlobalRewards(): void {
    const operation = this.startOperation();
    this.clearGamePicker();
    this.mode.set('global');
    this.loading.set(true);
    this.error.set(null);
    this.otherGamePrompt.set(false);
    this.preserveResultsHeight();
    this.items.set([]);
    this.topGames.set([]);
    this.hovered.set(null);
    this.selectedAppId.set(null);
    this.selectedClass.set(null);
    this.globalTotalCount.set(null);
    this.scanProgress.set({ done: 0, total: GLOBAL_REWARD_LIMIT });

    this.activeRequest = forkJoin({
      rewards: this.shop.queryGlobalRewards(GLOBAL_REWARD_LIMIT),
      games: this.shop.queryTopGames(TOP_GAME_LIMIT, TOP_GAME_SAMPLE_LIMIT),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.finishOperation(operation)),
    ).subscribe({
      next: ({ rewards, games }) => {
        if (!this.isActiveOperation(operation)) return;
        this.items.set(rewards.items);
        this.rememberRewardAppNames(rewards.items);
        this.topGames.set(games);
        this.rememberTopGameNames(games);
        this.globalTotalCount.set(rewards.total);
        this.scanProgress.set({ done: rewards.count, total: rewards.total || rewards.count });
      },
      error: (e: { message?: string }) => {
        if (!this.isActiveOperation(operation)) return;
        this.error.set(e?.message ?? 'scan failed');
      },
    });
  }

  // -- Class filter ---------------------------------------------------------

  toggleApp(appid: number): void {
    const game = this.topGames().find((g) => g.appid === appid);
    this.pickAppId(appid, game?.name ?? this.appLabel(appid));
  }

  clearApp(): void {
    this.selectedAppId.set(null);
  }

  returnToTopGames(): void {
    if (this.mode() === 'top') {
      this.clearApp();
      return;
    }

    this.loadTopSellingRewards();
  }

  openOtherGameSearch(): void {
    this.startOperation();
    this.mode.set('single');
    this.loading.set(false);
    this.error.set(null);
    this.otherGamePrompt.set(true);
    this.preserveResultsHeight();
    this.items.set([]);
    this.hovered.set(null);
    this.selectedAppId.set(null);
    this.selectedClass.set(null);
    this.scanProgress.set({ done: 0, total: 0 });
    this.globalTotalCount.set(null);
    this.clearGamePicker();

    setTimeout(() => {
      const input = this.host.nativeElement.querySelector('#game') as HTMLInputElement | null;
      input?.focus();
    }, 0);
  }

  toggleClass(c: number): void {
    this.selectedClass.set(this.selectedClass() === c ? null : c);
  }

  clearClass(): void {
    this.selectedClass.set(null);
  }

  isTopGameActive(appid: number): boolean {
    if (this.otherGamePrompt()) return false;
    if (this.selectedAppId() === appid) return true;
    return this.mode() === 'single' && this.selectedGame().appid === appid;
  }

  isOtherGameActive(): boolean {
    if (this.otherGamePrompt()) return true;
    if (this.mode() !== 'single') return false;
    return !this.topGames().some((game) => game.appid === this.selectedGame().appid);
  }

  // -- Cursor / floater -----------------------------------------------------

  onMouseMove(ev: MouseEvent): void {
    let x = ev.clientX + FLOATER_MARGIN;
    let y = ev.clientY + FLOATER_MARGIN;
    if (typeof window !== 'undefined') {
      if (x + FLOATER_W > window.innerWidth) x = ev.clientX - FLOATER_W - FLOATER_MARGIN;
      if (y + FLOATER_H > window.innerHeight) y = window.innerHeight - FLOATER_H - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
    }
    this.cursor.set({ x, y });
  }

  showPreviewFromElement(it: RewardDefinition, ev: Event): void {
    this.hovered.set(it);
    const el = ev.currentTarget as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorX = rect.right;
    const anchorY = rect.top + rect.height / 2;
    this.placeFloater(anchorX, anchorY);
  }

  togglePreview(it: RewardDefinition, ev: Event): void {
    ev.preventDefault();
    if (this.isPreviewed(it)) {
      this.hovered.set(null);
      return;
    }
    this.showPreviewFromElement(it, ev);
  }

  isPreviewed(it: RewardDefinition): boolean {
    const h = this.hovered();
    return h?.appid === it.appid && h.defid === it.defid;
  }

  // -- Row helpers ----------------------------------------------------------

  thumbUrl(it: RewardDefinition): string | null {
    return buildAssetUrl(it.appid, rewardThumbnailFile(it));
  }

  isAnimated(it: RewardDefinition): boolean {
    return rewardHasAnimation(it);
  }

  assetHref(it: RewardDefinition): string | null {
    return buildAssetUrl(it.appid, rewardSmallVideoFile(it) ?? rewardImageFile(it));
  }

  shopHref(it: RewardDefinition): string {
    return buildShopUrl(it.appid, it.defid);
  }

  classLabel(it: RewardDefinition): string {
    return rewardClassLabel(it.community_item_class);
  }

  classLabelFor(c: number): string {
    return rewardClassLabel(c);
  }

  itemTitle(it: RewardDefinition): string {
    return rewardTitle(it);
  }

  appLabel(appid: number): string {
    this.appNameVersion();
    return this.appNames.get(appid) ?? 'Unknown app';
  }

  suggestionId(hit: AppHit): string {
    return `game-option-${hit.appid}`;
  }

  activeSuggestionId(): string | null {
    const hit = this.gameSuggestions()[this.activeSuggestionIndex()];
    return hit ? this.suggestionId(hit) : null;
  }

  previewLabel(it: RewardDefinition): string {
    return `Preview ${rewardTitle(it)} from ${this.appLabel(it.appid)}`;
  }

  toggleSoundMuted(): void {
    this.setSoundMuted(!this.soundMuted());
  }

  setSoundMuted(muted: boolean): void {
    this.soundMuted.set(muted);
    const mediaElements = this.host.nativeElement.querySelectorAll('audio, video') as NodeListOf<HTMLMediaElement>;
    mediaElements.forEach((media: HTMLMediaElement) => {
      media.muted = muted;
    });
  }

  pad(n: number): string {
    return String(n).padStart(4, '0');
  }

  progressPercent(): number {
    const p = this.scanProgress();
    if (p.total === 0) return 0;
    return Math.round((p.done / p.total) * 100);
  }

  private itemSearchText(it: RewardDefinition): string {
    return [
      rewardTitle(it),
      it.community_item_data?.item_description ?? '',
      this.appLabel(it.appid),
      String(it.appid),
      String(it.defid),
      rewardClassLabel(it.community_item_class),
      it.point_cost,
    ].join(' ').toLowerCase();
  }

  private startOperation(): number {
    this.activeOperation += 1;
    this.activeRequest?.unsubscribe();
    this.activeRequest = null;
    return this.activeOperation;
  }

  private clearGamePicker(): void {
    this.gamePickerInput.set('');
    this.gameSuggestions.set([]);
    this.gamePickerOpen.set(false);
    this.activeSuggestionIndex.set(-1);
    this.gameSearching.set(false);
  }

  private rememberTopGameNames(games: TopGame[]): void {
    for (const game of games) {
      this.rememberAppName(game.appid, game.name);
    }
  }

  private rememberRewardAppNames(items: RewardDefinition[]): void {
    const ids = [...new Set(items.map((it) => it.appid))]
      .filter((appid) => !this.appNames.has(appid));
    if (!ids.length) return;

    forkJoin(
      ids.map((appid) =>
        this.shop.getAppName(appid).pipe(
          switchMap((name) => of({ appid, name })),
        ),
      ),
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((apps) => {
      for (const app of apps) {
        this.rememberAppName(app.appid, app.name);
      }
    });
  }

  private rememberAppName(appid: number, name: string): void {
    if (!name || this.appNames.get(appid) === name) return;
    this.appNames.set(appid, name);
    this.appNameVersion.update((version) => version + 1);
  }

  private isActiveOperation(operation: number): boolean {
    return operation === this.activeOperation;
  }

  private finishOperation(operation: number): void {
    if (!this.isActiveOperation(operation)) return;
    this.loading.set(false);
    this.activeRequest = null;
    setTimeout(() => {
      if (this.isActiveOperation(operation)) this.resultsMinHeight.set(0);
    }, 0);
  }

  private preserveResultsHeight(): void {
    if (typeof window === 'undefined') return;

    const results = this.host.nativeElement.querySelector('.results-stage') as HTMLElement | null;
    const height = results?.getBoundingClientRect().height ?? 0;
    if (height > 0) this.resultsMinHeight.set(Math.ceil(height));
  }

  private placeFloater(anchorX: number, anchorY: number): void {
    let x = anchorX + FLOATER_MARGIN;
    let y = anchorY - FLOATER_H / 2;
    if (typeof window !== 'undefined') {
      if (x + FLOATER_W > window.innerWidth) x = anchorX - FLOATER_W - FLOATER_MARGIN;
      if (y + FLOATER_H > window.innerHeight) y = window.innerHeight - FLOATER_H - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
    }
    this.cursor.set({ x, y });
  }
}
