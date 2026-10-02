import apiClient, { Paginated, toPaginated, unwrapData } from './shared';

export interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedBy: { id: string; fullName: string } | null;
  createdAt: string;
}

export interface PaginatedMedia extends Paginated<MediaAsset> {}

export const mediaApi = {
  async uploadMedia(file: File | Blob, width?: number, height?: number, name?: string): Promise<MediaAsset> {
    const form = new FormData();
    form.append('file', file);
    if (width) form.append('width', String(width));
    if (height) form.append('height', String(height));
    if (name) form.append('name', name);
    const res = await apiClient.post('/api/v1/admin/media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapData<MediaAsset>(res);
  },

  async getMedia(page = 1, limit = 24, search?: string): Promise<PaginatedMedia> {
    const res = await apiClient.get('/api/v1/admin/media', {
      params: { page, limit, ...(search?.trim() ? { search: search.trim() } : {}) },
    });
    return toPaginated<MediaAsset>(unwrapData<unknown>(res), page, limit);
  },

  async deleteMedia(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/media/${id}`);
  },
};
