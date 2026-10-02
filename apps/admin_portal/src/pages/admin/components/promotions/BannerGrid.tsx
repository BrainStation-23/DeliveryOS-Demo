import React from 'react';
import { ExternalLink, Image as ImageIcon, Link2, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { AdminBanner } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/common/EmptyState';
import { QueryErrorBanner } from '../../../../components/common/QueryErrorBanner';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';

interface BannerGridProps {
  banners: AdminBanner[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onToggle: (banner: AdminBanner) => void;
  onEdit: (banner: AdminBanner) => void;
  onDelete: (banner: AdminBanner) => void;
  onAdd: () => void;
}

const LINK_BADGE_VARIANTS: Record<AdminBanner['linkType'], { label: string; icon: typeof Store }> = {
  OUTLET: { label: 'Outlet', icon: Store },
  CATEGORY: { label: 'Category', icon: Link2 },
  EXTERNAL: { label: 'External', icon: ExternalLink },
};

export const BannerGrid: React.FC<BannerGridProps> = ({
  banners,
  isLoading,
  error,
  onRetry,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
}) => {
  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <LoadingSpinner size="lg" label="Loading promotional banners..." />
      </div>
    );
  }

  if (error) {
    return <QueryErrorBanner error={error} onRetry={onRetry} />;
  }

  if (banners.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="No promotional banners"
        message="No promotional banners created yet. Add your first hero banner to showcase offers."
        action={
          <Button size="sm" onClick={onAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Add Banner
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {banners.map((banner) => {
        const linkBadge = LINK_BADGE_VARIANTS[banner.linkType] ?? LINK_BADGE_VARIANTS.OUTLET;
        const LinkIcon = linkBadge.icon;
        return (
          <div
            key={banner.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
          >
            <div>
              <div className="relative h-40 bg-slate-100 dark:bg-slate-800">
                <img
                  src={resolveMediaUrl(banner.imageUrl)}
                  alt={banner.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {banner.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="default">Paused</Badge>
                  )}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {banner.title}
                </h3>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800">
                    <LinkIcon className="h-3 w-3" />
                    {linkBadge.label}
                  </span>
                  <span>Rank #{banner.sortOrder}</span>
                </div>
                {banner.linkType === 'EXTERNAL' && banner.targetUrl && (
                  <p className="mt-1 truncate text-[11px] text-slate-400" title={banner.targetUrl}>
                    {banner.targetUrl}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 pt-0">
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => onToggle(banner)}
                  >
                    {banner.isActive ? 'Pause' : 'Activate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                    onClick={() => onEdit(banner)}
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={() => onDelete(banner)}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
