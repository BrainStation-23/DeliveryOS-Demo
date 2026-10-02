import React, { useMemo, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Crop, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Alert } from '../ui/Alert';
import {
  CROP_ASPECT_PRESETS,
  RESIZE_CAPS,
  computeResizedDimensions,
  cropImageToBlob,
} from '../../utils/imageEdit';
import { defaultMediaNameForFile, normalizeMediaName } from '../../utils/mediaName';
import type { EditedImage } from '../../hooks/useMediaUpload';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface UploadEditorModalProps {
  file: File | null;
  isUploading: boolean;
  onClose: () => void;
  onConfirm: (edited: EditedImage) => void;
}

export const UploadEditorModal: React.FC<UploadEditorModalProps> = ({
  file,
  isUploading,
  onClose,
  onConfirm,
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [crop, setCrop] = useState<PercentCrop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspectId, setAspectId] = useState<string>('FREE');
  const [resizeCapId, setResizeCapId] = useState<string>('PX_1920');
  const [mediaName, setMediaName] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Revoke the preview URL whenever the staged file changes or the editor closes.
  React.useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Each newly staged file starts from a clean selection and its default name.
  React.useEffect(() => {
    if (file) {
      setCrop(undefined);
      setCompletedCrop(null);
      setEditError(null);
      setMediaName(defaultMediaNameForFile(file.name));
    }
  }, [file]);

  const aspect = CROP_ASPECT_PRESETS.find((p) => p.id === aspectId)?.value;
  const resizeCap = RESIZE_CAPS.find((c) => c.id === resizeCapId)?.maxDimension;

  const selectionWidth = completedCrop?.width || naturalSize.width;
  const selectionHeight = completedCrop?.height || naturalSize.height;
  const outputDims = computeResizedDimensions(selectionWidth, selectionHeight, resizeCap);

  const applyAspectPreset = (presetId: string) => {
    setAspectId(presetId);
    const preset = CROP_ASPECT_PRESETS.find((p) => p.id === presetId);
    if (!imgRef.current || !naturalSize.width || !preset) return;
    if (preset.value === undefined) {
      setCrop(undefined);
      setCompletedCrop(null);
      return;
    }
    const nextCrop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        preset.value,
        naturalSize.width,
        naturalSize.height,
      ),
      naturalSize.width,
      naturalSize.height,
    );
    setCrop(nextCrop);
    setCompletedCrop(null);
  };

  const handleConfirm = async () => {
    const image = imgRef.current;
    if (!image || !naturalSize.width) return;
    const effectiveCrop: PixelCrop =
      completedCrop && completedCrop.width > 0 && completedCrop.height > 0
        ? completedCrop
        : { unit: 'px', x: 0, y: 0, width: naturalSize.width, height: naturalSize.height };

    setIsEncoding(true);
    setEditError(null);
    try {
      const edited = await cropImageToBlob(image, effectiveCrop, file?.type || 'image/jpeg', resizeCap);
      if (edited.blob.size > MAX_UPLOAD_BYTES) {
        setEditError(
          `The edited image is ${(edited.blob.size / (1024 * 1024)).toFixed(1)} MB — above the 5 MB limit. Pick a smaller size cap and try again.`,
        );
        return;
      }
      onConfirm({
        ...edited,
        name: normalizeMediaName(mediaName, defaultMediaNameForFile(file?.name || '')),
      });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to process the image.');
    } finally {
      setIsEncoding(false);
    }
  };

  return (
    <Modal
      isOpen={!!file}
      onClose={onClose}
      size="xl"
      title="Edit Before Upload"
      description="Drag and resize the selection, then pick an output size. The full image is used when nothing is selected."
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Output: {outputDims.width > 0 ? `${outputDims.width} × ${outputDims.height} px` : '—'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isUploading || isEncoding}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} isLoading={isUploading || isEncoding}>
              Upload to Media Library
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {editError && <Alert type="error" message={editError} onDismiss={() => setEditError(null)} />}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Media Name (shown in the library and used for search)
          </label>
          <input
            type="text"
            value={mediaName}
            onChange={(e) => setMediaName(e.target.value)}
            maxLength={255}
            placeholder="e.g. Weekend Feast Hero Banner"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Aspect</span>
            {CROP_ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyAspectPreset(preset.id)}
                className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors select-none cursor-pointer ${
                  aspectId === preset.id
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Size</span>
            <select
              value={resizeCapId}
              onChange={(e) => setResizeCapId(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {RESIZE_CAPS.map((cap) => (
                <option key={cap.id} value={cap.id}>
                  {cap.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40 max-h-[52vh] overflow-auto">
          {objectUrl && (
            <ReactCrop
              crop={crop}
              onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
              onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
              aspect={aspect}
              keepSelection
            >
              <img
                src={objectUrl}
                alt={file?.name || 'Upload preview'}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
                }}
                ref={imgRef}
                className="max-h-[48vh] w-auto select-none"
                style={{ imageRendering: 'auto' }}
              />
            </ReactCrop>
          )}
        </div>

        {file && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Crop className="h-3.5 w-3.5" />
              {file.name} · {naturalSize.width > 0 ? `${naturalSize.width} × ${naturalSize.height} px source` : 'reading…'}
            </span>
            {file.type === 'image/gif' && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Info className="h-3.5 w-3.5" />
                Animated GIFs are saved as a static frame after editing.
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
