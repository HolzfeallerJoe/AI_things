import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { QueryRewardsResponse, RewardDefinition } from './reward.model';

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
}

export interface TopGame {
  appid: number;
  name: string;
  count: number;
}

interface RewardQueryOptions {
  sort?: number;
  sortDescending?: boolean;
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
          .slice(0, safeLimit);
      }),
      switchMap((apps) => {
        if (!apps.length) return of([]);
        return forkJoin(
          apps.map((app) =>
            this.getAppName(app.appid).pipe(
              map((name) => ({
                appid: app.appid,
                name,
                count: app.count,
              })),
            ),
          ),
        );
      }),
    );
  }

  queryGlobalRewards(count = 1000): Observable<RewardPage> {
    return this.queryRewardPage(count);
  }

  private queryRewardPage(count: number, options: RewardQueryOptions = {}): Observable<RewardPage> {
    const requested = Number.isFinite(count) ? Math.floor(count) : 1000;
    const safeCount = Math.max(1, Math.min(requested, 1000));
    const inputPayload: Record<string, number | boolean> = { count: safeCount };
    if (options.sort != null) inputPayload['sort'] = options.sort;
    if (options.sortDescending != null) inputPayload['sort_descending'] = options.sortDescending;
    const input = encodeURIComponent(JSON.stringify(inputPayload));
    const url = `/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/?input_json=${input}`;
    return this.http.get<QueryRewardsResponse>(url).pipe(
      map((res) => {
        const items = uniqueRewards(res?.response?.definitions ?? []);
        return {
          items,
          total: res?.response?.total_count ?? 0,
          count: res?.response?.count ?? items.length,
        };
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

function uniqueRewards(items: RewardDefinition[]): RewardDefinition[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.appid}:${item.defid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
