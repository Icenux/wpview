import type { ItemState, ViewerItem } from '@wpview';

// Mock data inspirovaná reálným tvarem gallery `Photo` (viz /home/lukas/DEV/gallery
// frontend/src/types/api.ts) — EXIF-like meta, různé poměry stran. wpview sám
// žádné API nezná, tohle je jen dev harness proti mock datům (žádný backend).

const COLORS = ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#6d597a', '#355070', '#b56576'];

const CAMERAS = [
  { make: 'FUJIFILM', model: 'X-T4', lens: 'XF 35mm f/1.4' },
  { make: 'Canon', model: 'EOS R6', lens: 'RF 24-70mm f/2.8' },
  { make: 'Apple', model: 'iPhone 14 Pro', lens: 'iPhone 14 Pro back triple camera 6.86mm f/1.78' },
  { make: 'SONY', model: 'A7 IV', lens: 'FE 50mm f/1.8' },
];

const ASPECTS = [
  { width: 1600, height: 1067 }, // 3:2 landscape
  { width: 1067, height: 1600 }, // 2:3 portrait
  { width: 1600, height: 1600 }, // 1:1 square
  { width: 1920, height: 1080 }, // 16:9
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

// Skutečný rastr (canvas -> JPEG data URI), ne SVG — createImageBitmap (edit
// pipeline v src/edit/encode.ts) SVG data URI nedokáže dekódovat
// (InvalidStateError), takže by rotate/crop na mock datech nikdy neprošly.
function placeholderSrc(seed: string, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = COLORS[hashString(seed) % COLORS.length]!;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(width / 12)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(seed, width / 2, height / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function buildItem(index: number): ViewerItem {
  const id = `photo-${index + 1}`;
  const aspect = ASPECTS[index % ASPECTS.length]!;
  const camera = CAMERAS[index % CAMERAS.length]!;
  const takenAt = new Date(2024, (index * 3) % 12, (index % 27) + 1, 9 + (index % 10), (index * 7) % 60);
  const thumbHeight = Math.round((320 * aspect.height) / aspect.width);

  return {
    id,
    thumbSrc: placeholderSrc(id, 320, thumbHeight),
    fullSrc: placeholderSrc(id, aspect.width, aspect.height),
    width: aspect.width,
    height: aspect.height,
    meta: {
      filename: `IMG_${1000 + index}.jpg`,
      taken_at: takenAt.toISOString(),
      camera_make: camera.make,
      camera_model: camera.model,
      lens_model: camera.lens,
      iso: [100, 200, 400, 800][index % 4],
      aperture: [1.8, 2.8, 4, 5.6][index % 4],
      focal_length: [24, 35, 50, 85][index % 4],
      ...(index % 5 === 0 ? { description: 'Golden hour on the coast' } : {}),
    },
  };
}

export const MOCK_ITEM_COUNT = 24;

export const MOCK_ITEMS: ViewerItem[] = Array.from({ length: MOCK_ITEM_COUNT }, (_, i) => buildItem(i));

const TAG_SETS = [['travel', 'sunset'], ['family'], []];

export const MOCK_ITEM_STATE: Record<string, ItemState> = Object.fromEntries(
  MOCK_ITEMS.map((item, i) => [
    item.id,
    {
      rating: i % 6,
      favorite: i % 7 === 0,
      tags: TAG_SETS[i % TAG_SETS.length],
    } satisfies ItemState,
  ]),
);
