import type { ImagePickerAsset } from 'expo-image-picker';

// Shared by anything that uploads a picked photo (message media, avatars) —
// storage only needs a stable extension/contentType pair per image kind.
export function extensionAndTypeForImage(asset: ImagePickerAsset): { extension: string; contentType: string } {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (mimeType === 'image/png') return { extension: '.png', contentType: mimeType };
  if (mimeType === 'image/webp') return { extension: '.webp', contentType: mimeType };
  return { extension: '.jpg', contentType: 'image/jpeg' };
}
