import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Images, RefreshCw, Search, Upload } from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { QueryErrorBanner } from '../common/QueryErrorBanner';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { UploadEditorModal } from './UploadEditorModal';
import { resolveMediaUrl } from '../../utils/mediaUrl';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the persisted (relative) media URL of the chosen asset. */
  onSelect: (url: string) => void;
}

/**
 * Central asset picker for any creation module that needs an image URL
 * (promotional banners today, future modules tomorrow). Uploads made here
 * land in the same shared media library.
 */
export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { pendingFile, isUploading, handleFileChosen, handleEditorConfirm, handleEditorCancel } =
    useMediaUpload({
      onError: (message) => setActionError(message),
    });

  const { data: mediaData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-media', 1, debouncedSearch],
    queryFn: () => adminApi.getMedia(1, 24, debouncedSearch),
    enabled: isOpen,
  });

  const assets = Array.isArray(mediaData?.items) ? mediaData.items : [];

  return (
    <>
      <Modal
        isOpen={isOpen && !pendingFile}
        onClose={onClose}
        size="xl"
        title="Select from Media Library"
        description="Every platform image lives here. Upload and edit a new asset or pick an existing one."
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {mediaData ? `${mediaData.total} assets in library` : ''}
            </span>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Upload New Image
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">{actionError}</div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search media by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading media library..." />
            </div>
          ) : isError ? (
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          ) : assets.length === 0 ? (
            <EmptyState
              icon={Images}
              title={debouncedSearch ? 'No media matches your search' : 'No media uploaded yet'}
              message={
                debouncedSearch
                  ? `Nothing in the library matches “${debouncedSearch}”. Try a different name or upload a new image.`
                  : 'The media library is empty. Upload your first image to make it available everywhere.'
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset.url);
                    onClose();
                  }}
                  className="group text-left rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-primary-400 hover:ring-2 hover:ring-primary-500/20 transition-all dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
                  title={`Use ${asset.originalName}`}
                >
                  <div className="h-24 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    <img
                      src={resolveMediaUrl(asset.url)}
                      alt={asset.originalName}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {asset.originalName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center pt-1">
            <Button variant="ghost" size="sm" onClick={() => refetch()} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
          </div>
        </div>
      </Modal>

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
    </>
  );
};
