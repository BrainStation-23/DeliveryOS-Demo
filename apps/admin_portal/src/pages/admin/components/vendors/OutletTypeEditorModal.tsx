import React, { useEffect, useState } from 'react';
import { Tags, Sparkles, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { AdminOutletType } from '../../../../services/adminApi';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { slugify } from './outletTypeHelpers';
import { cn } from '../../../../utils/cn';

export interface OutletTypeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingType: AdminOutletType | null;
  isSaving: boolean;
  onSave: (payload: {
    name: string;
    slug?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) => void;
}

export const OutletTypeEditorModal: React.FC<OutletTypeEditorModalProps> = ({
  isOpen,
  onClose,
  editingType,
  isSaving,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isSlugManuallyModified, setIsSlugManuallyModified] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  useEffect(() => {
    if (editingType) {
      setName(editingType.name);
      setSlug(editingType.slug);
      setSortOrder(String(editingType.sortOrder));
      setIsActive(editingType.isActive);
      setIsSlugManuallyModified(true);
      setSlugError(null);
    } else {
      setName('');
      setSlug('');
      setSortOrder('0');
      setIsActive(true);
      setIsSlugManuallyModified(false);
      setSlugError(null);
    }
  }, [editingType, isOpen]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!isSlugManuallyModified) {
      setSlug(slugify(newName));
      setSlugError(null);
    }
  };

  const handleSlugChange = (newSlug: string) => {
    setIsSlugManuallyModified(true);
    setSlug(newSlug);

    const trimmed = newSlug.trim();
    if (trimmed && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
      setSlugError('Slug must contain lowercase alphanumeric characters and single dashes only.');
    } else {
      setSlugError(null);
    }
  };

  const resetSlugToGenerated = () => {
    setIsSlugManuallyModified(false);
    setSlug(slugify(name));
    setSlugError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    const cleanSlug = slug.trim();
    if (cleanSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setSlugError('Invalid slug format. Use lowercase letters, digits, and single hyphens.');
      return;
    }

    const parsedSortOrder = parseInt(sortOrder, 10);
    const validSortOrder = Number.isInteger(parsedSortOrder) && parsedSortOrder >= 0 ? parsedSortOrder : 0;

    onSave({
      name: cleanName,
      slug: cleanSlug || undefined,
      sortOrder: validSortOrder,
      isActive,
    });
  };

  const isFormValid = name.trim().length >= 2 && !slugError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingType ? `Edit Outlet Type: ${editingType.name}` : 'New Outlet Business Type'}
      description="Define the consumer category name, system slug, and display sorting order for app discovery."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Live Customer App Chip Preview */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
              Customer App Chip Preview
            </span>
            <span className="text-[11px] font-medium">
              {isActive ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Visible in App
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Hidden from App
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs border transition-all',
                isActive
                  ? 'bg-white text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
                  : 'bg-slate-100 text-slate-400 border-dashed border-slate-300 dark:bg-slate-900/60 dark:text-slate-500 dark:border-slate-800',
              )}
            >
              <Tags
                className={cn(
                  'h-3.5 w-3.5',
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400',
                )}
              />
              <span>{name.trim() || 'Category Name'}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                #{sortOrder.trim() || '0'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {isActive
                ? 'Rendered in customer app top carousel'
                : 'Hidden from discovery; outlets administrable'}
            </span>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <Input
            label="Display Name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Restaurant, Super Shop, Pharmacy"
            helperText="The title shown on customer home screen chips and outlet profile settings."
            autoFocus
            required
          />
        </div>

        {/* Identifier Slug & Sort Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="outlet-type-slug"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                URL Slug
              </label>
              {isSlugManuallyModified && (
                <button
                  type="button"
                  onClick={resetSlugToGenerated}
                  className="text-[11px] text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 cursor-pointer"
                  title="Auto-derive from display name"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Auto-sync
                </button>
              )}
            </div>
            <Input
              id="outlet-type-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g. super-shop"
              error={slugError || undefined}
              helperText={!slugError ? 'Kebab-case URL and API filter identifier.' : undefined}
            />
          </div>

          <div>
            <Input
              label="Sort Order"
              type="number"
              min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              helperText="Determines carousel sequence. Lower numbers appear first."
            />
          </div>
        </div>

        {/* Customer Discovery Toggle Switch */}
        <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              {isActive ? (
                <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <EyeOff className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              )}
              Customer App Discovery
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              {isActive
                ? 'Enabled: customers can discover outlets assigned to this category.'
                : 'Disabled: immediately conceals all assigned outlets from customer view.'}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!isFormValid || isSaving} isLoading={isSaving}>
            {editingType ? 'Save Changes' : 'Create Outlet Type'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
