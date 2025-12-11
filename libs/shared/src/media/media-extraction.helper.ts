export interface MediaExtractionResult {
  images: string[];
  audio: string[];
  video: string[];
  all: string[];
}

/**
 * Extract media URLs from activity data structure
 * Supports:
 * - Activity.mediaUrls[] (array)
 * - Activity.mediaUrls (object: { audio: "url", video: "url" })
 * - Activity.content (JSON) - depends on activity type
 */
export function extractMediaFromActivity(activity: {
  type?: string;
  mediaUrls?: string[] | Record<string, string>;
  content?: any;
}): MediaExtractionResult {
  const images: string[] = [];
  const audio: string[] = [];
  const video: string[] = [];

  // From mediaUrls array or object
  if (activity.mediaUrls) {
    if (Array.isArray(activity.mediaUrls)) {
      activity.mediaUrls.forEach((url) => {
        if (url) categorizeUrl(url, images, audio, video);
      });
    } else if (typeof activity.mediaUrls === 'object') {
      // Assignment activities: { audio: "url", video: "url" }
      Object.values(activity.mediaUrls).forEach((url) => {
        if (url && typeof url === 'string') {
          categorizeUrl(url, images, audio, video);
        }
      });
    }
  }

  // From content (JSON) - depends on activity type
  if (activity.content) {
    extractUrlsFromContent(
      activity.type,
      activity.content,
      images,
      audio,
      video,
    );
  }

  return {
    images: [...new Set(images)],
    audio: [...new Set(audio)],
    video: [...new Set(video)],
    all: [...new Set([...images, ...audio, ...video])],
  };
}

function categorizeUrl(
  url: string,
  images: string[],
  audio: string[],
  video: string[],
): void {
  if (!url || typeof url !== 'string') return;

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    images.push(url);
  } else if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
    audio.push(url);
  } else if (lowerUrl.match(/\.(mp4|webm|mov|avi)$/i)) {
    video.push(url);
  }
}

function extractUrlsFromContent(
  activityType: string | undefined,
  content: any,
  images: string[],
  audio: string[],
  video: string[],
): void {
  if (!content || typeof content !== 'object') return;

  // VOCAB: content.items[].imageUrl, content.items[].audioUrl
  if (
    activityType === 'vocab' &&
    content.items &&
    Array.isArray(content.items)
  ) {
    content.items.forEach((item: any) => {
      if (item?.imageUrl) images.push(item.imageUrl);
      if (item?.audioUrl) audio.push(item.audioUrl);
    });
  }

  // LISTENING/DICTATION: content.audioUrl
  if (
    (activityType === 'listening' || activityType === 'dictation') &&
    content.audioUrl
  ) {
    audio.push(content.audioUrl);
  }

  // FLASHCARD: content.imageUrl
  if (activityType === 'flashcard' && content.imageUrl) {
    images.push(content.imageUrl);
  }

  // Other activity types may have media in content
  if (content.audioUrl) audio.push(content.audioUrl);
  if (content.videoUrl) video.push(content.videoUrl);
  if (content.imageUrl) images.push(content.imageUrl);
}

/**
 * Extract all media URLs from activity (simple array)
 */
export function extractMediaUrls(activity: {
  type?: string;
  mediaUrls?: string[] | Record<string, string>;
  content?: any;
}): string[] {
  const result = extractMediaFromActivity(activity);
  return result.all;
}
