import {readFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import { fileURLToPath } from 'node:url';
import type {Prisma} from '@prisma/client';
import {propertyGalleryUrls} from '@the-property-pillar/contracts';
import {z} from 'zod';
import {env} from '../config/env.js';

export const uploadDirectory = env.UPLOAD_ROOT ? resolve(env.UPLOAD_ROOT) : fileURLToPath(new URL('../../../../uploads/', import.meta.url));
export const uploadName = /^[a-f0-9]{64}\.(webp|mp4)$/;
const uploadPrefix = '/api/v1/uploads/';

export const workspaceImageFields = {
  properties: {mediaUrls: 'list'},
  dealerProfiles: {logoUrl: 'single', coverUrl: 'single'},
  materialProducts: {mediaUrls: 'list'},
  serviceProfiles: {portfolioUrls: 'list'},
  builderProjects: {mediaUrls: 'list'},
} as const;

type ImageCollection = keyof typeof workspaceImageFields;
const videoCollections = new Set<string>(['properties', 'materialProducts', 'serviceProfiles', 'builderProjects']);
type Purpose = `${ImageCollection}:${string}` | 'account:logoUrl' | 'homepageSlides:imageUrl' | 'homepageSlides:videoUrl' | 'articles:coverImage';
export const stagedUploadLifetime = 24 * 60 * 60 * 1000;
export type UploadOwner = {tenantId: string; userId: string; purpose: Purpose; stagedAt?: number};

export function imageFields(collection: string): Record<string, 'list' | 'single'> | undefined {
  if (!Object.hasOwn(workspaceImageFields, collection)) return undefined;
  const fields = workspaceImageFields[collection as ImageCollection];
  return videoCollections.has(collection) ? {...fields, videoUrl: 'single'} : fields;
}

export function isImagePurpose(value: string | undefined): value is Purpose {
  if (!value) return false;
  if (value === 'account:logoUrl' || value === 'homepageSlides:imageUrl' || value === 'homepageSlides:videoUrl' || value === 'articles:coverImage') return true;
  const [collection, field, extra] = value.split(':');
  return !extra && Boolean(collection && field && Object.hasOwn(imageFields(collection) ?? {}, field));
}

export function imageReferenceWhere(collection: string, url: string): Prisma.WorkspaceItemWhereInput[] {
  return Object.entries(imageFields(collection) ?? {}).map(([field, type]) => ({
    data: type === 'list' ? {path: [field], array_contains: [url]} : {path: [field], equals: url},
  }));
}

export function uploadedImageName(url: string) {
  const name = url.slice(uploadPrefix.length);
  return url.startsWith(uploadPrefix) && uploadName.test(name) ? name : null;
}

export async function uploadedImageExists(url: string) {
  const name = uploadedImageName(url);
  if (!name) return false;
  try {
    return (await stat(join(uploadDirectory, name))).isFile();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function imageOwner(name: string): Promise<UploadOwner | null> {
  try {
    return JSON.parse(await readFile(join(uploadDirectory, `${name}.json`), 'utf8')) as UploadOwner;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function canAttachImage(url: string, {tenantId, userId}: Omit<UploadOwner, 'purpose'>, purpose: string) {
  const name = uploadedImageName(url);
  const propertyGallery = purpose === 'properties:mediaUrls';
  if (!name || (!propertyGallery && name.endsWith('.mp4') !== purpose.endsWith(':videoUrl'))) return false;
  const owner = await imageOwner(name);
  const matchesPurpose = owner?.purpose === purpose || (propertyGallery && name.endsWith('.mp4') && owner?.purpose === 'properties:videoUrl');
  return owner?.tenantId === tenantId && owner.userId === userId && matchesPurpose &&
    (owner.stagedAt === undefined || Date.now() - owner.stagedAt < stagedUploadLifetime) && await uploadedImageExists(url);
}

export async function validateImageAttachments(collection: string, data: Record<string, unknown>, session: Omit<UploadOwner, 'purpose'>, previous: Record<string, unknown> = {}) {
  const checks = Object.keys(imageFields(collection) ?? {}).map(async (field) => {
    const urls = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string') : [];
    const kept = new Set(collection === 'properties' && field === 'mediaUrls' ? propertyGalleryUrls(previous) : urls(previous[field]));
    const valid = await Promise.all(urls(data[field]).filter((url) => !kept.has(url)).map((url) => canAttachImage(url, session, `${collection}:${field}`)));
    return valid.every(Boolean) ? [] : [{code: 'custom' as const, path: [field], message: 'Upload the file using this field before saving.'}];
  });
  const issues = (await Promise.all(checks)).flat();
  if (issues.length) throw new z.ZodError(issues);
}
