export interface CommunityItemData {
  item_name?: string;
  item_title?: string;
  item_description?: string;
  item_image_small?: string;
  item_image_large?: string;
  animated?: boolean;
  movie_webm?: string;
  movie_mp4?: string;
  movie_webm_small?: string;
  movie_mp4_small?: string;
  item_movie_webm?: string;
  item_movie_mp4?: string;
  item_movie_webm_small?: string;
  item_movie_mp4_small?: string;
}

export interface RewardDefinition {
  appid: number;
  defid: number;
  type: number;
  community_item_class?: number;
  point_cost: string;
  internal_description?: string;
  active?: boolean;
  timestamp_available?: number;
  timestamp_available_end?: number;
  community_item_data?: CommunityItemData;
}

export interface QueryRewardsResponse {
  response?: {
    definitions?: RewardDefinition[];
    total_count?: number;
    count?: number;
  };
}

export const ITEM_CLASS_LABELS: Record<number, string> = {
  3: 'Profile Background',
  4: 'Emoticon',
  5: 'Booster Pack',
  7: 'Trading Card',
  8: 'Game Profile',
  11: 'Animated Sticker',
  12: 'Chat Effect',
  13: 'Mini Profile Background',
  14: 'Avatar Frame',
  15: 'Animated Avatar',
  16: 'Keyboard Skin',
  17: 'Startup Movie',
};

const CDN_BASE = 'https://shared.cloudflare.steamstatic.com/community_assets/images/items';

export function buildAssetUrl(appid: number, file: string | undefined | null): string | null {
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  return `${CDN_BASE}/${appid}/${file}`;
}

export function buildShopUrl(appid: number, defid: number): string {
  return `https://store.steampowered.com/points/shop/app/${appid}/reward/${defid}`;
}

export function rewardImageFile(it: RewardDefinition): string | undefined {
  const d = it.community_item_data;
  return d?.item_image_large ?? d?.item_image_small;
}

export function rewardThumbnailFile(it: RewardDefinition): string | undefined {
  const d = it.community_item_data;
  if (isAnimatedImageReward(it)) {
    return d?.item_image_large ?? d?.item_image_small;
  }
  return d?.item_image_small ?? d?.item_image_large;
}

export function rewardPreviewImageFile(it: RewardDefinition): string | undefined {
  const d = it.community_item_data;
  if (isAnimatedImageReward(it)) {
    return d?.item_image_small ?? d?.item_image_large;
  }
  return d?.item_image_large ?? d?.item_image_small;
}

export function rewardVideoFile(it: RewardDefinition): string | undefined {
  const d = it.community_item_data;
  return d?.movie_webm
    ?? d?.item_movie_webm
    ?? d?.movie_webm_small
    ?? d?.item_movie_webm_small
    ?? d?.movie_mp4
    ?? d?.item_movie_mp4
    ?? d?.movie_mp4_small
    ?? d?.item_movie_mp4_small;
}

export function rewardSmallVideoFile(it: RewardDefinition): string | undefined {
  const d = it.community_item_data;
  return d?.movie_webm_small
    ?? d?.item_movie_webm_small
    ?? d?.movie_mp4_small
    ?? d?.item_movie_mp4_small
    ?? rewardVideoFile(it);
}

export function rewardHasAnimation(it: RewardDefinition): boolean {
  return it.community_item_data?.animated === true || rewardVideoFile(it) != null;
}

function isAnimatedImageReward(it: RewardDefinition): boolean {
  return it.community_item_data?.animated === true && !rewardVideoFile(it);
}

export function rewardTitle(it: RewardDefinition): string {
  return (
    it.community_item_data?.item_title ||
    it.community_item_data?.item_name ||
    it.internal_description ||
    `defid ${it.defid}`
  );
}

export function rewardClassLabel(c: number | undefined): string {
  if (c == null) return '—';
  return ITEM_CLASS_LABELS[c] ?? `CLASS ${c}`;
}
