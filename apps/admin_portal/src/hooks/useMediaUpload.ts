import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import adminApi, { MediaAsset } from '../services/adminApi';
import { extractApiError } from '../utils/apiError';

export interface EditedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
  /** Library display name chosen in the editor. */
  name: string;
}

interface UseMediaUploadOptions {
  onUploaded?: (asset: MediaAsset) => void;
  onError?: (message: string) => void;
}

/**
 * Owns the central upload flow: file selection, the crop/resize editor stage,
 * and the media library mutation. Consumers render their own file input and
 * the UploadEditorModal wired to these handlers.
 */
export function useMediaUpload({ onUploaded, onError }: UseMediaUploadOptions) {
  const queryClient = useQueryClient();
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: ({ file, width, height, name }: { file: File; width?: number; height?: number; name?: string }) =>
      adminApi.uploadMedia(file, width, height, name),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      onUploaded?.(asset);
    },
    onError: (err) => onError?.(extractApiError(err, 'Media upload failed.')),
  });

  const handleFileChosen = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        onError?.('Only image files can be uploaded to the media library.');
        return;
      }
      setPendingFile(file);
    },
    [onError],
  );

  const handleEditorConfirm = useCallback(
    (edited: EditedImage) => {
      if (!pendingFile) return;
      const file = new File([edited.blob], edited.name || pendingFile.name || 'upload', {
        type: edited.mimeType,
      });
      setPendingFile(null);
      uploadMutation.mutate({ file, width: edited.width, height: edited.height, name: edited.name });
    },
    [pendingFile, uploadMutation],
  );

  const handleEditorCancel = useCallback(() => setPendingFile(null), []);

  return {
    pendingFile,
    isUploading: uploadMutation.isPending,
    handleFileChosen,
    handleEditorConfirm,
    handleEditorCancel,
  };
}
