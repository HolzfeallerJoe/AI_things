import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  Subscription,
  catchError,
  finalize,
  from,
  map,
  mergeMap,
  of,
  shareReplay,
  switchMap,
  toArray,
} from 'rxjs';
import { QueryRewardsResponse, RewardDefinition, rewardClassLabel, rewardTitle } from './reward.model';

export interface AppHit {
  appid: number;
  name: string;
  icon?: string;
  logo?: string;
}

export interface RewardPage {
  items: RewardDefinition[];
  total: number;
  count: number;
  nextCursor?: string;
}

export interface RewardScanProgress {
  scanned: number;
  total: number;
  matches: number;
}

export interface RewardScanResult extends RewardScanProgress {
  items: RewardDefinition[];
}

export interface TopGame {
  appid: number;
  name: string;
  count: number;
}

interface RewardQueryOptions {
  sort?: number;
  sortDescending?: boolean;
  cursor?: string;
}

interface RewardScanOptions {
  getKnownAppName?: (appid: number) => string | undefined;
  onProgress?: (progress: RewardScanProgress) => void;
  pageDelayMs?: number;
}

interface RawAppHit {
  appid: string | number;
  name: string;
  icon?: string;
  logo?: string;
}

interface AppDetailsResponse {
  [appid: string]: {
    success?: boolean;
    data?: {
      name?: string;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class PointsShopService {
  private http = inject(HttpClient);
  private readonly globalScanPageDelayMs = 5000;
  private readonly appNameConcurrency = 1;
  private appNameCache = new Map<number, string>();
  private appNameRequests = new Map<number, Observable<string>>();

  queryRewards(appid: number): Observable<RewardDefinition[]> {
    const input = encodeURIComponent(JSON.stringify({ appids: [appid] }));
    const url = `/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/?input_json=${input}`;
    return this.http.get<QueryRewardsResponse>(url).pipe(
      map((res) => uniqueRewards(res?.response?.definitions ?? [])),
    );
  }

  queryTopSellingRewards(count = 10): Observable<RewardPage> {
    return this.queryRewardPage(count, {
      sort: 2,
      sortDescending: false,
    });
  }

  queryTopGames(limit = 10, sampleCount = 1000): Observable<TopGame[]> {
    const safeLimit = Math.max(1, Math.floor(limit));
    return this.queryTopSellingRewards(sampleCount).pipe(
      map((page) => {
        const seen = new Map<number, { appid: number; count: number; rank: number }>();
        for (const item of page.items) {
          const current = seen.get(item.appid);
          if (current) {
            current.count += 1;
          } else {
            seen.set(item.appid, {
              appid: item.appid,
              count: 1,
              rank: seen.size,
            });
          }
        }
        return [...seen.values()]
          .sort((a, b) => b.count - a.count || a.rank - b.rank)
          .slice(0, safeLimit)
          .map((app) => ({
            appid: app.appid,
            name: this.appNameCache.get(app.appid) ?? '',
            count: app.count,
          }));
      }),
    );
  }

  queryGlobalRewards(count = 1000): Observable<RewardPage> {
    return this.queryRewardPage(count);
  }

  scanGlobalRewards(query: string, options: RewardScanOptions = {}): Observable<RewardScanResult> {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return of({ items: [], scanned: 0, total: 0, matches: 0 });
    }

    return new Observable<RewardScanResult>((subscriber) => {
      const matches: RewardDefinition[] = [];
      const seen = new Set<string>();
      let activeRequest: Subscription | null = null;
      let nextPageTimer: ReturnType<typeof setTimeout> | null = null;
      let scanned = 0;
      let total = 0;
      const pageDelayMs = options.pageDelayMs ?? this.globalScanPageDelayMs;

      const emitProgress = () => {
        const progress = {
          scanned,
          total: total || scanned,
          matches: matches.length,
        };
        options.onProgress?.(progress);
        subscriber.next({ ...progress, items: [...matches] });
      };

      const requestPage = (cursor?: string) => {
        if (subscriber.closed) return;

        activeRequest = this.queryRewardPage(1000, { cursor }).subscribe({
          next: (page) => {
            if (subscriber.closed) return;

            scanned += Math.max(page.count, page.items.length);
            total = page.total || total;

            for (const item of page.items) {
              const key = rewardKey(item);
              if (seen.has(key)) continue;
              if (!rewardMatchesQuery(item, needle, options.getKnownAppName?.(item.appid))) continue;

              seen.add(key);
              matches.push(item);
            }

            emitProgress();

            if (page.nextCursor && page.count > 0) {
              if (pageDelayMs <= 0) {
                requestPage(page.nextCursor);
                return;
              }

              nextPageTimer = setTimeout(() => requestPage(page.nextCursor), pageDelayMs);
              return;
            }

            subscriber.complete();
          },
          error: (error) => subscriber.error(error),
        });
      };

      requestPage();

      return () => {
        if (nextPageTimer) clearTimeout(nextPageTimer);
        activeRequest?.unsubscribe();
      };
    });
  }

  private queryRewardPage(count: number, options: RewardQueryOptions = {}): Observable<RewardPage> {
    const requested = Number.isFinite(count) ? Math.floor(count) : 1000;
    const safeCount = Math.max(1, Math.min(requested, 1000));
    const inputPayload: Record<string, number | boolean | string> = { count: safeCount };
    if (options.sort != null) inputPayload['sort'] = options.sort;
    if (options.sortDescending != null) inputPayload['sort_descending'] = options.sortDescending;
    if (options.cursor) inputPayload['cursor'] = options.cursor;
    const input = encodeURIComponent(JSON.stringify(inputPayload));
    const url = `/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/?input_json=${input}`;
    return this.http.get<QueryRewardsResponse>(url).pipe(
      map((res) => {
        const items = uniqueRewards(res?.response?.definitions ?? []);
        const page: RewardPage = {
          items,
          total: res?.response?.total_count ?? 0,
          count: res?.response?.count ?? items.length,
        };
        if (res?.response?.next_cursor) page.nextCursor = res.response.next_cursor;
        return page;
      }),
    );
  }

  searchApps(term: string): Observable<AppHit[]> {
    const t = term.trim();
    if (!t) return of([]);
    const url = `/steam-community/actions/SearchApps/${encodeURIComponent(t)}`;
    return this.http.get<RawAppHit[]>(url).pipe(
      map((arr) =>
        (arr ?? []).map((h) => ({
          appid: Number(h.appid),
          name: h.name,
          icon: h.icon,
          logo: h.logo,
        })),
      ),
      catchError(() => of<AppHit[]>([])),
    );
  }

  getAppName(appid: number): Observable<string> {
    if (!Number.isFinite(appid) || appid <= 0) return of('Unknown app');

    const cached = this.appNameCache.get(appid);
    if (cached) return of(cached);

    const active = this.appNameRequests.get(appid);
    if (active) return active;

    const request = this.fetchAppName(appid).pipe(
      map((name) => normalizeAppName(name)),
      map((name) => {
        if (!/^unknown app$/i.test(name)) this.appNameCache.set(appid, name);
        return name;
      }),
      finalize(() => this.appNameRequests.delete(appid)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.appNameRequests.set(appid, request);
    return request;
  }

  getAppNames(appids: number[]): Observable<{ appid: number; name: string }[]> {
    const ids = [...new Set(appids)]
      .filter((appid) => Number.isFinite(appid) && appid > 0);
    if (!ids.length) return of([]);

    return from(ids).pipe(
      mergeMap(
        (appid) => this.getAppName(appid).pipe(
          map((name) => ({ appid, name })),
        ),
        this.appNameConcurrency,
      ),
      toArray(),
      map((apps) => apps.sort((a, b) => ids.indexOf(a.appid) - ids.indexOf(b.appid))),
    );
  }

  private fetchAppName(appid: number): Observable<string> {
    const url = `/steam-store/api/appdetails?appids=${appid}&filters=basic`;
    return this.http.get<AppDetailsResponse>(url).pipe(
      map((res) => res[String(appid)]?.data?.name || ''),
      switchMap((name) => (name ? of(name) : this.getCommunityAppName(appid))),
      catchError(() => this.getCommunityAppName(appid)),
    );
  }

  private getCommunityAppName(appid: number): Observable<string> {
    return this.http.get(`/steam-community/app/${appid}`, { responseType: 'text' }).pipe(
      map((html) => parseCommunityAppName(html)),
      catchError(() => of('Unknown app')),
    );
  }
}

function parseCommunityAppName(html: string): string {
  const appHubName = html.match(/<div[^>]*class="[^"]*\bapphub_AppName\b[^"]*"[^>]*>([^<]+)<\/div>/i)?.[1];
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const rawName = appHubName ?? ogTitle ?? title ?? '';
  const name = decodeHtmlText(rawName).replace(/^Steam Community\s*::\s*/i, '').trim();

  if (!name || /^error$/i.test(name) || /too many requests/i.test(name)) {
    return 'Unknown app';
  }
  return name;
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeAppName(name: string): string {
  const normalized = name.trim();
  return normalized || 'Unknown app';
}

function uniqueRewards(items: RewardDefinition[]): RewardDefinition[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = rewardKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rewardKey(item: RewardDefinition): string {
  return `${item.appid}:${item.defid}`;
}

function rewardMatchesQuery(item: RewardDefinition, needle: string, knownAppName: string | undefined): boolean {
  const data = item.community_item_data;
  return [
    rewardTitle(item),
    data?.item_name ?? '',
    data?.item_description ?? '',
    item.internal_description ?? '',
    knownAppName ?? '',
    String(item.appid),
    String(item.defid),
    rewardClassLabel(item.community_item_class),
    item.point_cost,
  ].join(' ').toLowerCase().includes(needle);
}
