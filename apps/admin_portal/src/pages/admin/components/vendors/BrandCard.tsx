import React from 'react';
import { Store, Edit2, Trash2, Users } from 'lucide-react';
import { AdminBrand } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';

interface BrandCardProps {
  brand: AdminBrand;
  isDeleting: boolean;
  onEdit: (brand: AdminBrand) => void;
  onRequestDelete: (brand: AdminBrand) => void;
}

export const BrandCard: React.FC<BrandCardProps> = ({ brand, isDeleting, onEdit, onRequestDelete }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-start gap-4">
    <div className="h-12 w-12 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center shrink-0 overflow-hidden">
      {brand.logoUrl ? (
        <img src={resolveMediaUrl(brand.logoUrl)} alt={brand.name} className="h-full w-full object-cover" />
      ) : (
        <Store className="h-5 w-5" />
      )}
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{brand.name}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Store className="h-3 w-3" /> {brand.totalOutlets} outlet{brand.totalOutlets === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {brand.totalStaff} staff
            </span>
          </p>
        </div>
        {brand.totalOutlets > 0 && <Badge variant="success">Operating</Badge>}
      </div>
    </div>

    <div className="inline-flex items-center gap-1.5 shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onEdit(brand)}
        leftIcon={<Edit2 className="h-3 w-3" />}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
        onClick={() => onRequestDelete(brand)}
        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
        disabled={isDeleting}
      >
        Delete
      </Button>
    </div>
  </div>
);
