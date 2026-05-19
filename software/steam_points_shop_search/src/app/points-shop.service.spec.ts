import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { PointsShopService } from './points-shop.service';
import { RewardDefinition } from './reward.model';

describe('PointsShopService', () => {
  let service: PointsShopService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PointsShopService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PointsShopService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('maps reward definitions from QueryRewardItems', () => {
    const item = reward({ appid: 730, defid: 11, title: 'Frame' });
    let received: RewardDefinition[] | undefined;

    service.queryRewards(730).subscribe((items) => {
      received = items;
    });

    const req = http.expectOne((request) =>
      request.url.includes('/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toContain('%7B%22appids%22%3A%5B730%5D%7D');
    req.flush({ response: { definitions: [item] } });

    expect(received).toEqual([item]);
  });

  it('removes exact duplicate reward definitions', () => {
    const item = reward({ appid: 730, defid: 11, title: 'Frame' });
    const otherClassVariant = { ...item, defid: 12, community_item_class: 15 };
    let received: RewardDefinition[] | undefined;

    service.queryRewards(730).subscribe((items) => {
      received = items;
    });

    const req = http.expectOne((request) =>
      request.url.includes('/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/'),
    );
    req.flush({ response: { definitions: [item, item, otherClassVariant] } });

    expect(received).toEqual([item, otherClassVariant]);
  });

  it('maps app search hits and normalizes app ids', () => {
    let received: unknown;

    service.searchApps('counter strike').subscribe((hits) => {
      received = hits;
    });

    const req = http.expectOne('/steam-community/actions/SearchApps/counter%20strike');
    req.flush([{ appid: '730', name: 'Counter-Strike 2', icon: 'icon.jpg' }]);

    expect(received).toEqual([{ appid: 730, name: 'Counter-Strike 2', icon: 'icon.jpg' }]);
  });

  it('maps global reward index metadata', () => {
    const item = reward({ appid: 730, defid: 1, title: 'A' });
    let received: unknown;

    service.queryGlobalRewards(5000).subscribe((page) => {
      received = page;
    });

    const req = http.expectOne((request) =>
      request.url.includes('/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/'),
    );
    expect(req.request.urlWithParams).toContain('%7B%22count%22%3A1000%7D');
    req.flush({ response: { definitions: [item], count: 1, total_count: 151706 } });

    expect(received).toEqual({ items: [item], count: 1, total: 151706 });
  });

  it('requests top-selling reward ordering', () => {
    let received: unknown;

    service.queryTopSellingRewards(10).subscribe((page) => {
      received = page;
    });

    const req = http.expectOne((request) =>
      request.url.includes('/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/'),
    );
    expect(req.request.urlWithParams).toContain('%22count%22%3A10');
    expect(req.request.urlWithParams).toContain('%22sort%22%3A2');
    expect(req.request.urlWithParams).toContain('%22sort_descending%22%3Afalse');
    req.flush({ response: { definitions: [], count: 0, total_count: 151706 } });

    expect(received).toEqual({ items: [], count: 0, total: 151706 });
  });

  it('derives top games from top-selling rewards and resolves app names', () => {
    let received: unknown;

    service.queryTopGames(2, 5).subscribe((games) => {
      received = games;
    });

    const rewardsReq = http.expectOne((request) =>
      request.url.includes('/steam-api/ILoyaltyRewardsService/QueryRewardItems/v1/'),
    );
    expect(rewardsReq.request.urlWithParams).toContain('%22count%22%3A5');
    rewardsReq.flush({
      response: {
        definitions: [
          reward({ appid: 570, defid: 1, title: 'A' }),
          reward({ appid: 570, defid: 2, title: 'B' }),
          reward({ appid: 730, defid: 3, title: 'C' }),
          reward({ appid: 730, defid: 4, title: 'D' }),
          reward({ appid: 730, defid: 5, title: 'E' }),
        ],
        count: 5,
        total_count: 151706,
      },
    });

    http.expectOne('/steam-store/api/appdetails?appids=570&filters=basic').flush({
      '570': { success: true, data: { name: 'Dota 2' } },
    });
    http.expectOne('/steam-store/api/appdetails?appids=730&filters=basic').flush({
      '730': { success: true, data: { name: 'Counter-Strike 2' } },
    });

    expect(received).toEqual([
      { appid: 730, name: 'Counter-Strike 2', count: 3 },
      { appid: 570, name: 'Dota 2', count: 2 },
    ]);
  });

  it('falls back to the Steam Community app page when store appdetails is unavailable', () => {
    let received: string | undefined;

    service.getAppName(534380).subscribe((name) => {
      received = name;
    });

    http.expectOne('/steam-store/api/appdetails?appids=534380&filters=basic').flush('not json', {
      status: 200,
      statusText: 'OK',
    });
    http.expectOne('/steam-community/app/534380').flush(`
      <html>
        <head><title>Steam Community :: Dying Light 2: Reloaded Edition</title></head>
        <body><div class="apphub_AppName">Dying Light 2: Reloaded Edition</div></body>
      </html>
    `);

    expect(received).toBe('Dying Light 2: Reloaded Edition');
  });
});

function reward(input: { appid: number; defid: number; title: string }): RewardDefinition {
  return {
    appid: input.appid,
    defid: input.defid,
    type: 1,
    community_item_class: 13,
    point_cost: '1000',
    community_item_data: {
      item_title: input.title,
      item_description: `${input.title} description`,
    },
  };
}
