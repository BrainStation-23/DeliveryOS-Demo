import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface GoogleMapsLinkProps {
  latitude?: number | null;
  longitude?: number | null;
  addressFallback?: string | null;
  variant?: 'icon' | 'button' | 'badge';
  label?: string;
  className?: string;
  title?: string;
}

/**
 * Builds standard Google Maps search URL from coordinates or address string.
 */
export function buildGoogleMapsUrl(
  latitude?: number | null,
  longitude?: number | null,
  addressFallback?: string | null
): string | null {
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    (latitude !== 0 || longitude !== 0)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  if (addressFallback && addressFallback.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressFallback.trim())}`;
  }
  return null;
}

/**
 * Clickable Google Maps link component. Supports a compact inline icon near
 * addresses or an explicit action button with external link indicator.
 */
export const GoogleMapsLink: React.FC<GoogleMapsLinkProps> = ({
  latitude,
  longitude,
  addressFallback,
  variant = 'button',
  label = 'Google Maps',
  className,
  title,
}) => {
  const url = buildGoogleMapsUrl(latitude, longitude, addressFallback);
  if (!url) return null;

  const hasCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    (latitude !== 0 || longitude !== 0);

  const defaultTitle = hasCoords
    ? `Open exact location on Google Maps (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
    : 'Open address on Google Maps';

  if (variant === 'icon') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title || defaultTitle}
        className={cn(
          'inline-flex items-center justify-center p-1 rounded hover:bg-primary-50 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 dark:hover:bg-primary-950/40 transition-colors shrink-0 cursor-pointer',
          className
        )}
        aria-label={title || defaultTitle}
      >
        <MapPin className="h-3.5 w-3.5" />
      </a>
    );
  }

  if (variant === 'badge') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title || defaultTitle}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 px-1.5 py-0.5 rounded bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:hover:bg-primary-900/50 transition-colors shrink-0 cursor-pointer',
          className
        )}
      >
        <MapPin className="h-3 w-3" />
        <span>{label}</span>
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={title || defaultTitle}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 px-2 py-0.5 rounded border border-primary-200 dark:border-primary-800/80 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors shrink-0 cursor-pointer',
        className
      )}
    >
      <MapPin className="h-3 w-3" />
      <span>{label}</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
};
