import { nanoid } from 'nanoid';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { NO_FILL } from '../../shared/constants/colors.constants';
import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from '../../shared/constants/media.constants';
import type { CanvasObject } from '../../shared/types';
import { persistDataUrl } from './persist-media';

/** Largest edge of an image as placed on the canvas (world units). */
const PLACED_MAX = 420;

/**
 * Converts an image file into a canvas object: downscaled to
 * IMAGE_MAX_DIMENSION, re-encoded, placed at a capped world size.
 * Prefers `/api/v1/media/...` over inline data URLs.
 */
export async function fileToImageObject(
  file: File,
  center: { x: number; y: number },
  z: number,
  createdBy: string,
): Promise<CanvasObject | null> {
  if (!file.type.startsWith('image/')) return null;

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const downscale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
  let src = dataUrl;
  let mimeType = file.type || 'image/png';
  if (downscale < 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * downscale);
    canvas.height = Math.round(img.height * downscale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    src = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
    mimeType = 'image/jpeg';
  }

  src = await persistDataUrl(src, mimeType);

  const placeScale = Math.min(1, PLACED_MAX / Math.max(img.width, img.height));
  const width = Math.round(img.width * placeScale);
  const height = Math.round(img.height * placeScale);

  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'image',
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: 0,
    fill: NO_FILL,
    src,
    z,
    createdBy,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
