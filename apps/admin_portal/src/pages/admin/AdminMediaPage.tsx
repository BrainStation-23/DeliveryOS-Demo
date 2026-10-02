import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Images, Upload, Copy, Check, Trash2 } from 'lucide-react';
import adminApi, { MediaAsset } from '../../services/adminApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { UploadEditorModal } from '../../components/media/UploadEditorModal';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatBytes, formatDateTime } from '../../utils/formatters';
import { extractApiError } from '../../utils/apiError';

const MIME_SHORT_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
};

export const AdminMediaPage: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);

  const { pendingFile, isUploading, handleFileChosen, handleEditorConfirm, handleEditorCancel } =
    useMediaUpload({
      onUploaded: (asset) => setUploadNotice(`${asset.originalName} uploaded — URL copied to your clipboard is available below.`),
      onError: (message) => setActionError(message),
    });

  const { data: mediaData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-media', page],
    queryFn: () => adminApi.getMedia(page, 24),
  });

  const assets = Array.isArray(mediaData?.items) ? mediaData.items : [];
  const totalPages = mediaData?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteMedia(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      setDeleteTarget(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete the media asset.')),
  });

  const copyUrl = async (asset: MediaAsset) => {
    const absolute = resolveMediaUrl(asset.url);
    try {
      await navigator.clipboard.writeText(absolute);
    } catch {
      // Clipboard API unavailable (insecure context) — fall back to the legacy path.
      const textarea = document.createElement('textarea');
      textarea.value = absolute;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedAssetId(asset.id);
    window.setTimeout(() => setCopiedAssetId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library & Asset Control"
        subtitle="Central home for every platform image: crop and resize before upload, then reuse the URLs across banners and future modules"
        icon={Images}
        actions={
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="h-4 w-4" />}
            disabled={isUploading}
          >
            Upload Media
          </Button>
        }
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}
      {uploadNotice && (
        <Alert type="success" message={uploadNotice} onDismiss={() => setUploadNotice(null)} />
      )}

      {isError ? (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" label="Loading media library..." />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No media uploaded yet"
          message="Upload your first image — crop and resize it right in the browser before it lands in the library."
          action={
            <Button size="sm" onClick={() => fileInputRef.current?.click()} leftIcon={<Upload className="h-4 w-4" />}>
              Upload Media
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col"
              >
                <div className="h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img
                    src={resolveMediaUrl(asset.url)}
                    alt={asset.originalName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={asset.originalName}>
                      {asset.originalName}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {MIME_SHORT_LABELS[asset.mimeType] || asset.mimeType} · {formatBytes(asset.sizeBytes)}
                      {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <p>Uploaded {formatDateTime(asset.createdAt, 'date')}</p>
                    {asset.uploadedBy && <p>By {asset.uploadedBy.fullName}</p>}
                  </div>

                  <div className="mt-auto pt-2 flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 px-2 py-1.5">
                    <code className="flex-1 text-[10px] text-slate-600 dark:text-slate-400 truncate" title={asset.url}>
                      {asset.url}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyUrl(asset)}
                      title="Copy URL"
                      aria-label="Copy URL"
                    >
                      {copiedAssetId === asset.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="px-4 pb-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    onClick={() => setDeleteTarget(asset)}
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          handleFileChosen(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <UploadEditorModal
        file={pendingFile}
        isUploading={isUploading}
        onClose={handleEditorCancel}
        onConfirm={handleEditorConfirm}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Media Asset?"
        variant="danger"
        confirmLabel="Delete Asset"
        message={
          deleteTarget && (
            <>
              <p>
                Permanently delete <strong className="text-slate-900 dark:text-slate-100">{deleteTarget.originalName}</strong> and
                its stored file?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Banners or modules still referencing this URL will lose their image — detach it there first.
              </p>
            </>
          )
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
