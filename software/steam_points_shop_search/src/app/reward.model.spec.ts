import { describe, expect, it } from 'vitest';
import {
  RewardDefinition,
  buildAssetUrl,
  buildShopUrl,
  rewardClassLabel,
  rewardImageFile,
  rewardPreviewImageFile,
  rewardSmallVideoFile,
  rewardThumbnailFile,
  rewardTitle,
  rewardVideoFile,
} from './reward.model';

describe('reward model helpers', () => {
  it('builds Steam CDN asset URLs for relative files', () => {
    expect(buildAssetUrl(730, 'avatar.png')).toBe(
      'https://shared.cloudflare.steamstatic.com/community_assets/images/items/730/avatar.png',
    );
  });

  it('preserves absolute asset URLs and returns null for missing files', () => {
    expect(buildAssetUrl(730, 'https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(buildAssetUrl(730, undefined)).toBeNull();
  });

  it('builds points shop reward links', () => {
    expect(buildShopUrl(730, 121190)).toBe(
      'https://store.steampowered.com/points/shop/app/730/reward/121190',
    );
  });

  it('uses the expected title fallback order', () => {
    const item = {
      defid: 1,
      appid: 730,
      type: 1,
      point_cost: '1000',
      internal_description: 'internal',
      community_item_data: {
        item_name: 'name',
        item_title: 'title',
      },
    } satisfies RewardDefinition;

    expect(rewardTitle(item)).toBe('title');
    expect(rewardTitle({ ...item, community_item_data: { item_name: 'name' } })).toBe('name');
    expect(rewardTitle({ ...item, community_item_data: undefined })).toBe('internal');
    expect(rewardTitle({ ...item, internal_description: undefined, community_item_data: undefined })).toBe('defid 1');
  });

  it('labels known, unknown, and missing classes', () => {
    expect(rewardClassLabel(8)).toBe('Game Profile');
    expect(rewardClassLabel(11)).toBe('Animated Sticker');
    expect(rewardClassLabel(12)).toBe('Chat Effect');
    expect(rewardClassLabel(13)).toBe('Mini Profile Background');
    expect(rewardClassLabel(14)).toBe('Avatar Frame');
    expect(rewardClassLabel(15)).toBe('Animated Avatar');
    expect(rewardClassLabel(17)).toBe('Startup Movie');
    expect(rewardClassLabel(999)).toBe('CLASS 999');
    expect(rewardClassLabel(undefined)).toBe('—');
  });

  it('resolves chat effect movie fields even when animated is false', () => {
    const item = {
      defid: 1,
      appid: 730,
      type: 1,
      community_item_class: 17,
      point_cost: '3000',
      community_item_data: {
        item_image_small: 'chat-small.avif',
        item_image_large: 'chat-large.avif',
        item_movie_webm: 'chat-large.webm',
        item_movie_mp4: 'chat-large.mp4',
        item_movie_webm_small: 'chat-small.webm',
        animated: false,
      },
    } satisfies RewardDefinition;

    expect(rewardThumbnailFile(item)).toBe('chat-small.avif');
    expect(rewardImageFile(item)).toBe('chat-large.avif');
    expect(rewardVideoFile(item)).toBe('chat-large.webm');
    expect(rewardSmallVideoFile(item)).toBe('chat-small.webm');
  });

  it('keeps animated image thumbnails static but previews animated', () => {
    const item = {
      defid: 1,
      appid: 730,
      type: 1,
      community_item_class: 14,
      point_cost: '2000',
      community_item_data: {
        item_image_small: 'frame-animated.png',
        item_image_large: 'frame-static.png',
        animated: true,
      },
    } satisfies RewardDefinition;

    expect(rewardThumbnailFile(item)).toBe('frame-static.png');
    expect(rewardPreviewImageFile(item)).toBe('frame-animated.png');
  });
});
