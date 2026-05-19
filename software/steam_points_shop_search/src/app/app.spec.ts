import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AppHit, PointsShopService } from './points-shop.service';
import { RewardDefinition } from './reward.model';

describe('App', () => {
  let service: {
    queryRewards: ReturnType<typeof vi.fn>;
    searchApps: ReturnType<typeof vi.fn>;
    queryTopSellingRewards: ReturnType<typeof vi.fn>;
    queryTopGames: ReturnType<typeof vi.fn>;
    queryGlobalRewards: ReturnType<typeof vi.fn>;
    scanGlobalRewards: ReturnType<typeof vi.fn>;
    getAppName: ReturnType<typeof vi.fn>;
    getAppNames: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      queryRewards: vi.fn(() => of([])),
      searchApps: vi.fn(() => of([])),
      queryTopSellingRewards: vi.fn(() => of({ items: [], count: 0, total: 0 })),
      queryTopGames: vi.fn(() => of([])),
      queryGlobalRewards: vi.fn(() => of({ items: [], count: 0, total: 0 })),
      scanGlobalRewards: vi.fn(() => of({ items: [], scanned: 0, total: 0, matches: 0 })),
      getAppName: vi.fn((appid: number) => of(`Game ${appid}`)),
      getAppNames: vi.fn((appids: number[]) => of(appids.map((appid) => ({ appid, name: `Game ${appid}` })))),
    };

    TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: PointsShopService, useValue: service }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('ignores stale single-game reward requests', () => {
    const requests: Subject<RewardDefinition[]>[] = [];
    service.queryRewards.mockImplementation(() => {
      const request = new Subject<RewardDefinition[]>();
      requests.push(request);
      return request.asObservable();
    });

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.pickAppId(730, 'Counter-Strike 2');
    component.pickAppId(570, 'Dota 2');
    requests[0].next([reward({ appid: 730, defid: 1, title: 'Old' })]);
    requests[0].complete();

    expect(component.items()).toEqual([]);
    expect(component.loading()).toBe(true);

    const current = reward({ appid: 570, defid: 2, title: 'Current' });
    requests[1].next([current]);
    requests[1].complete();

    expect(component.items()).toEqual([current]);
    expect(component.loading()).toBe(false);
  });

  it('loads the top 10 selling rewards on startup', () => {
    const item = reward({ appid: 730, defid: 10, title: 'Popular Frame' });
    service.queryTopSellingRewards.mockReturnValue(of({
      items: [item],
      count: 1,
      total: 151706,
    }));
    service.queryTopGames.mockReturnValue(of([
      { appid: 730, name: 'Counter-Strike 2', count: 4 },
      { appid: 570, name: 'Dota 2', count: 3 },
    ]));

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(service.queryTopSellingRewards).toHaveBeenCalledWith(component.topSellingLimit);
    expect(service.queryTopGames).toHaveBeenCalledWith(component.topGameLimit, 1000);
    expect(component.mode()).toBe('top');
    expect(component.gamePickerInput()).toBe('');
    expect(component.items()).toEqual([item]);
    expect(component.topGames()).toEqual([
      { appid: 730, name: 'Counter-Strike 2', count: 4 },
      { appid: 570, name: 'Dota 2', count: 3 },
    ]);
    expect(component.scanProgress()).toEqual({ done: 1, total: 1 });
  });

  it('preserves top-selling item order on the initial top view', () => {
    const first = reward({ appid: 570, defid: 1, title: 'First' });
    const second = reward({ appid: 730, defid: 2, title: 'Second' });
    service.queryTopSellingRewards.mockReturnValue(of({
      items: [first, second],
      count: 2,
      total: 151706,
    }));

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.filtered()).toEqual([first, second]);
  });

  it('renders the top view before app names finish hydrating', () => {
    const name = new Subject<string>();
    const item = reward({ appid: 1263950, defid: 78792, title: 'Birthday' });
    service.queryTopSellingRewards.mockReturnValue(of({
      items: [item],
      count: 1,
      total: 151706,
    }));
    service.queryTopGames.mockReturnValue(of([{ appid: 1263950, name: '', count: 17 }]));
    service.getAppName.mockReturnValue(name.asObservable());

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.items()).toEqual([item]);
    expect(component.topGames()).toEqual([{ appid: 1263950, name: '', count: 17 }]);
    expect(component.topGameLabel(component.topGames()[0])).toBe('App 1263950');
    expect(service.getAppName).toHaveBeenCalledWith(1263950);

    name.next('The Debut Collection');
    name.complete();

    expect(component.topGameLabel(component.topGames()[0])).toBe('The Debut Collection');
    expect(component.appLabel(1263950)).toBe('The Debut Collection');
  });

  it('resolves app names for loaded rewards outside the top-game chips', () => {
    const item = reward({ appid: 321360, defid: 10, title: 'Primal Reward' });
    service.queryTopSellingRewards.mockReturnValue(of({
      items: [item],
      count: 1,
      total: 151706,
    }));
    service.getAppName.mockReturnValue(of('Primal Carnage: Extinction'));

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(service.getAppName).toHaveBeenCalledWith(321360);
    expect(component.appLabel(321360)).toBe('Primal Carnage: Extinction');
  });

  it('loads the global rewards index without a static catalog', () => {
    const item = reward({ appid: 570, defid: 1, title: 'Dota Frame' });
    service.queryGlobalRewards.mockReturnValue(of({
      items: [item],
      count: 1,
      total: 151706,
    }));
    service.queryTopGames.mockReturnValue(of([{ appid: 570, name: 'Dota 2', count: 2 }]));

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.gamePickerInput.set('Counter-Strike 2');
    component.gameSuggestions.set([{ appid: 730, name: 'Counter-Strike 2' }]);
    component.gamePickerOpen.set(true);
    component.activeSuggestionIndex.set(0);

    component.loadGlobalRewards();

    expect(service.queryGlobalRewards).toHaveBeenCalledWith(component.globalRewardLimit);
    expect(service.queryTopGames).toHaveBeenCalledWith(component.topGameLimit, 1000);
    expect(component.items()).toEqual([item]);
    expect(component.topGames()).toEqual([{ appid: 570, name: 'Dota 2', count: 2 }]);
    expect(component.globalTotalCount()).toBe(151706);
    expect(component.scanProgress()).toEqual({ done: 1, total: 151706 });
    expect(component.gamePickerInput()).toBe('');
    expect(component.gameSuggestions()).toEqual([]);
    expect(component.gamePickerOpen()).toBe(false);
    expect(component.activeSuggestionIndex()).toBe(-1);
  });

  it('scans the full global catalog for item keywords when requested', () => {
    const scan = new Subject<{
      items: RewardDefinition[];
      scanned: number;
      total: number;
      matches: number;
    }>();
    const item = reward({ appid: 637310, defid: 103182, title: 'Cat Cam talking' });
    service.scanGlobalRewards.mockReturnValue(scan.asObservable());

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onQueryInput('cat');
    expect(service.scanGlobalRewards).not.toHaveBeenCalled();

    component.loadGlobalRewards();

    expect(service.scanGlobalRewards).toHaveBeenCalledWith('cat', {
      getKnownAppName: expect.any(Function),
      onProgress: expect.any(Function),
    });
    expect(component.mode()).toBe('global');
    expect(component.loading()).toBe(true);

    const options = service.scanGlobalRewards.mock.calls[0][1];
    options.onProgress({ scanned: 1000, total: 151706, matches: 1 });
    expect(component.scanProgress()).toEqual({ done: 1000, total: 151706 });

    scan.next({ items: [item], scanned: 1000, total: 151706, matches: 1 });
    expect(component.items()).toEqual([item]);
    expect(component.filtered()).toEqual([item]);
    expect(service.getAppName).toHaveBeenCalledWith(637310);
    expect(component.appLabel(637310)).toBe('Game 637310');

    scan.complete();
    expect(component.loading()).toBe(false);
  });

  it('cancels a stale global keyword scan when a new one starts', () => {
    let firstUnsubscribed = false;
    const second = new Subject<{
      items: RewardDefinition[];
      scanned: number;
      total: number;
      matches: number;
    }>();
    const current = reward({ appid: 570, defid: 2, title: 'Dog Courier' });
    service.scanGlobalRewards
      .mockReturnValueOnce(new Observable(() => () => {
        firstUnsubscribed = true;
      }))
      .mockReturnValueOnce(second.asObservable());

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.scanGlobalRewardsForQuery('cat');
    component.scanGlobalRewardsForQuery('dog');

    expect(firstUnsubscribed).toBe(true);
    expect(service.scanGlobalRewards).toHaveBeenCalledTimes(2);

    second.next({ items: [current], scanned: 2000, total: 151706, matches: 1 });
    second.complete();

    expect(component.items()).toEqual([current]);
    expect(component.loading()).toBe(false);
  });

  it('stops an active global keyword scan and keeps current matches', () => {
    let unsubscribed = false;
    const item = reward({ appid: 637310, defid: 103182, title: 'Cat Cam talking' });
    const scan = new Subject<{
      items: RewardDefinition[];
      scanned: number;
      total: number;
      matches: number;
    }>();
    service.scanGlobalRewards.mockReturnValue(new Observable((subscriber) => {
      const sub = scan.subscribe(subscriber);
      return () => {
        unsubscribed = true;
        sub.unsubscribe();
      };
    }));

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.scanGlobalRewardsForQuery('cat');
    scan.next({ items: [item], scanned: 1000, total: 151706, matches: 1 });

    component.stopSearch();

    expect(unsubscribed).toBe(true);
    expect(component.loading()).toBe(false);
    expect(component.items()).toEqual([item]);
    expect(component.scanProgress()).toEqual({ done: 1000, total: 151706 });
  });

  it('filters by title, app metadata, ids, class label, and cost', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const item = reward({ appid: 730, defid: 121190, title: 'Tactical Frame', cost: '3000', cls: 14 });
    component.items.set([item]);
    component.mode.set('global');

    for (const query of ['tactical', 'counter-strike', '730', '121190', 'avatar frame', '3000']) {
      component.query.set(query);
      expect(component.filtered()).toEqual([item]);
    }
  });

  it('paginates visible rows with an adjustable default page size', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const rewards = Array.from({ length: 15 }, (_, idx) =>
      reward({ appid: 730, defid: idx + 1, title: `Reward ${idx + 1}` }),
    );
    component.items.set(rewards);

    expect(component.pageSize()).toBe(10);
    expect(component.totalPages()).toBe(2);
    expect(component.visibleRows()).toEqual(rewards.slice(0, 10));
    expect(component.pageStartIndex()).toBe(0);
    expect(component.pageEndIndex()).toBe(10);

    component.nextPage();

    expect(component.currentPage()).toBe(2);
    expect(component.visibleRows()).toEqual(rewards.slice(10, 15));
    expect(component.pageStartIndex()).toBe(10);
    expect(component.pageEndIndex()).toBe(15);

    component.onPageSizeInput(25);

    expect(component.pageSize()).toBe(25);
    expect(component.currentPage()).toBe(1);
    expect(component.totalPages()).toBe(1);
    expect(component.visibleRows()).toEqual(rewards);
  });

  it('hides placeholder class chips from the category filters', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.items.set([
      reward({ appid: 730, defid: 1, title: 'Placeholder', cls: 0 }),
      reward({ appid: 730, defid: 2, title: 'Game Profile', cls: 8 }),
      reward({ appid: 730, defid: 3, title: 'Frame', cls: 14 }),
    ]);

    expect(component.availableClasses()).toEqual([8, 14]);
  });

  it('loads all rewards for a selected top game chip', () => {
    const fullGameReward = reward({ appid: 730, defid: 99, title: 'Full Game Reward' });
    service.queryRewards.mockReturnValue(of([fullGameReward]));
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const cs2a = reward({ appid: 730, defid: 1, title: 'CS2 A' });
    const cs2b = reward({ appid: 730, defid: 2, title: 'CS2 B' });
    const dota = reward({ appid: 570, defid: 3, title: 'Dota A' });
    component.items.set([dota, cs2a, cs2b]);
    component.topGames.set([
      { appid: 730, name: 'Counter-Strike 2', count: 2 },
      { appid: 570, name: 'Dota 2', count: 1 },
    ]);
    component.mode.set('top');

    expect(component.topGames()).toEqual([
      { appid: 730, name: 'Counter-Strike 2', count: 2 },
      { appid: 570, name: 'Dota 2', count: 1 },
    ]);

    component.toggleApp(730);
    expect(service.queryRewards).toHaveBeenCalledWith(730);
    expect(component.mode()).toBe('single');
    expect(component.selectedGame()).toEqual({ appid: 730, name: 'Counter-Strike 2' });
    expect(component.isTopGameActive(730)).toBe(true);
    expect(component.isOtherGameActive()).toBe(false);
    expect(component.topGames()).toEqual([
      { appid: 730, name: 'Counter-Strike 2', count: 2 },
      { appid: 570, name: 'Dota 2', count: 1 },
    ]);
    expect(component.filtered()).toEqual([fullGameReward]);
  });

  it('returns from a selected game back to the top 10 view', () => {
    const topReward = reward({ appid: 570, defid: 1, title: 'Top Reward' });
    service.queryTopSellingRewards.mockReturnValue(of({
      items: [topReward],
      count: 1,
      total: 151706,
    }));
    service.queryTopGames.mockReturnValue(of([{ appid: 570, name: 'Dota 2', count: 1 }]));
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    service.queryTopSellingRewards.mockClear();
    service.queryTopGames.mockClear();
    component.mode.set('single');
    component.items.set([reward({ appid: 730, defid: 99, title: 'Full Game Reward' })]);

    component.returnToTopGames();

    expect(service.queryTopSellingRewards).toHaveBeenCalledWith(component.topSellingLimit);
    expect(service.queryTopGames).toHaveBeenCalledWith(component.topGameLimit, 1000);
    expect(component.mode()).toBe('top');
    expect(component.items()).toEqual([topReward]);
  });

  it('shows the other game chip for selected games outside the top list', () => {
    const otherReward = reward({ appid: 321360, defid: 99, title: 'Other Reward' });
    service.queryRewards.mockReturnValue(of([otherReward]));
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.topGames.set([
      { appid: 730, name: 'Counter-Strike 2', count: 2 },
      { appid: 570, name: 'Dota 2', count: 1 },
    ]);

    component.pickAppId(321360, 'Primal Carnage: Extinction');

    expect(component.mode()).toBe('single');
    expect(component.selectedGame()).toEqual({ appid: 321360, name: 'Primal Carnage: Extinction' });
    expect(component.isTopGameActive(730)).toBe(false);
    expect(component.isOtherGameActive()).toBe(true);
    expect(component.filtered()).toEqual([otherReward]);
  });

  it('opens the other game search hint without loading a game', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.topGames.set([
      { appid: 730, name: 'Counter-Strike 2', count: 2 },
      { appid: 570, name: 'Dota 2', count: 1 },
    ]);
    component.items.set([reward({ appid: 730, defid: 1, title: 'CS2 A' })]);
    component.mode.set('top');
    service.queryRewards.mockClear();

    component.openOtherGameSearch();

    expect(service.queryRewards).not.toHaveBeenCalled();
    expect(component.otherGamePrompt()).toBe(true);
    expect(component.isOtherGameActive()).toBe(true);
    expect(component.isTopGameActive(730)).toBe(false);
    expect(component.gamePickerInput()).toBe('');
    expect(component.items()).toEqual([]);
  });

  it('updates combobox active suggestion with keyboard input', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const hits: AppHit[] = [
      { appid: 730, name: 'Counter-Strike 2' },
      { appid: 570, name: 'Dota 2' },
    ];
    component.gameSuggestions.set(hits);
    component.gamePickerOpen.set(true);
    component.activeSuggestionIndex.set(0);

    component.onGamePickerKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.activeSuggestionIndex()).toBe(1);
    expect(component.activeSuggestionId()).toBe('game-option-570');

    component.onGamePickerKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.gamePickerOpen()).toBe(false);
    expect(component.activeSuggestionIndex()).toBe(-1);
  });

  it('shows the opposite game picker metadata beside the input', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.gamePickerInput.set('730');
    expect(component.gamePickerMeta()).toBe('Counter-Strike 2');

    component.gamePickerInput.set('Counter-Strike 2');
    expect(component.gamePickerMeta()).toBe('730');

    component.gamePickerInput.set('dot');
    component.gameSuggestions.set([
      { appid: 570, name: 'Dota 2' },
      { appid: 381210, name: 'Dead by Daylight' },
    ]);
    component.activeSuggestionIndex.set(0);

    expect(component.gamePickerMeta()).toBe('570');
  });

  it('toggles page media muting from the sound control', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const video = document.createElement('video');
    video.muted = false;
    fixture.nativeElement.appendChild(video);

    component.setSoundMuted(true);
    expect(component.soundMuted()).toBe(true);
    expect(video.muted).toBe(true);

    component.toggleSoundMuted();
    expect(component.soundMuted()).toBe(false);
  });

  it('downloads original reward assets as blobs', async () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const item = reward({ appid: 4130550, defid: 137212, title: 'Animated Frame' });
    item.community_item_data = {
      item_title: 'Animated Frame',
      item_image_small: 'animated.png',
      item_image_large: 'static.png',
      animated: true,
    };

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['asset'])),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:asset');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await component.downloadAsset(item);

    expect(fetchMock).toHaveBeenCalledWith('/steam-assets/4130550/animated.png');
    expect(click).toHaveBeenCalled();
    const anchor = appendChild.mock.calls.at(-1)?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Animated-Frame-4130550-137212.apng');
    expect(component.downloadingAsset()).toBeNull();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});

function reward(input: {
  appid: number;
  defid: number;
  title: string;
  cost?: string;
  cls?: number;
}): RewardDefinition {
  return {
    appid: input.appid,
    defid: input.defid,
    type: 1,
    community_item_class: input.cls ?? 13,
    point_cost: input.cost ?? '1000',
    community_item_data: {
      item_title: input.title,
      item_description: `${input.title} description`,
      item_image_small: 'small.png',
    },
  };
}
