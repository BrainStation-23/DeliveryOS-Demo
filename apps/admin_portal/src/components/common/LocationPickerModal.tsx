import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  Search,
  Check,
  Compass,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { apiClient } from '../../services/apiClient';

export interface LocationPickerModalProps {
  isOpen: boolean;
  initialLat?: number;
  initialLng?: number;
  outletName?: string;
  onClose: () => void;
  onConfirm: (coordinates: { latitude: number; longitude: number }) => void;
}

interface GeocodeItem {
  displayName: string;
  addressLine: string;
  latitude: number;
  longitude: number;
}

import {
  DHAKA_DEFAULT,
  POPULAR_AREAS,
  formatCoordinates,
  isValidCoordinate,
} from '../../utils/locationCoordinates';

export { DHAKA_DEFAULT, POPULAR_AREAS, formatCoordinates, isValidCoordinate };

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  initialLat,
  initialLng,
  outletName,
  onClose,
  onConfirm,
}) => {
  const hasInitialValid =
    typeof initialLat === 'number' &&
    Number.isFinite(initialLat) &&
    typeof initialLng === 'number' &&
    Number.isFinite(initialLng);

  const [currentLat, setCurrentLat] = useState<number>(
    hasInitialValid ? initialLat : DHAKA_DEFAULT[0]
  );
  const [currentLng, setCurrentLng] = useState<number>(
    hasInitialValid ? initialLng : DHAKA_DEFAULT[1]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      const lat = hasInitialValid ? initialLat : DHAKA_DEFAULT[0];
      const lng = hasInitialValid ? initialLng : DHAKA_DEFAULT[1];
      setCurrentLat(lat);
      setCurrentLng(lng);
      setSearchQuery('');
      setSearchResults([]);
      setGeoError(null);
    }
  }, [isOpen, initialLat, initialLng, hasInitialValid]);

  // Reverse geocode to show friendly address
  const fetchReverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await apiClient.get<{ data?: { addressLine?: string; displayName?: string } }>(
        '/api/v1/geo/reverse-geocode',
        { params: { lat, lng } }
      );
      const addr = res.data?.data?.addressLine || res.data?.data?.displayName;
      if (addr) {
        setDetectedAddress(addr);
      }
    } catch {
      // Non-blocking reverse geocode
    }
  }, []);

  // Initialize or re-center Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const customPin = L.divIcon({
        className: 'custom-location-pin',
        html: `
          <div style="transform: translate(-50%, -100%);">
            <div style="background-color: #e11d48; width: 34px; height: 34px; border-radius: 9999px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([currentLat, currentLng], {
        draggable: true,
        icon: customPin,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const nextLat = Number(pos.lat.toFixed(6));
        const nextLng = Number(pos.lng.toFixed(6));
        setCurrentLat(nextLat);
        setCurrentLng(nextLng);
        fetchReverseGeocode(nextLat, nextLng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const nextLat = Number(lat.toFixed(6));
        const nextLng = Number(lng.toFixed(6));
        marker.setLatLng([nextLat, nextLng]);
        setCurrentLat(nextLat);
        setCurrentLng(nextLng);
        fetchReverseGeocode(nextLat, nextLng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      fetchReverseGeocode(currentLat, currentLng);
    } else {
      mapInstanceRef.current.setView([currentLat, currentLng], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLng]);
      }
    }

    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, currentLat, currentLng, fetchReverseGeocode]);

  // Clean up map when modal fully closes
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [isOpen]);

  const handleSetPosition = (lat: number, lng: number) => {
    const formattedLat = Number(lat.toFixed(6));
    const formattedLng = Number(lng.toFixed(6));
    setCurrentLat(formattedLat);
    setCurrentLng(formattedLng);
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([formattedLat, formattedLng], 16);
      markerRef.current.setLatLng([formattedLat, formattedLng]);
    }
    fetchReverseGeocode(formattedLat, formattedLng);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        handleSetPosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setIsLocating(false);
        setGeoError(err.message || 'Unable to retrieve your current location.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setGeoError(null);
    try {
      const res = await apiClient.get<{ data?: GeocodeItem[] }>('/api/v1/geo/geocode', {
        params: { q: searchQuery.trim() },
      });
      const items = res.data?.data || [];
      setSearchResults(items);
      if (items.length === 0) {
        setGeoError('No matching locations found. Try a different query.');
      } else if (items.length === 1) {
        // Automatically jump if single match
        handleSetPosition(items[0].latitude, items[0].longitude);
        setSearchResults([]);
      }
    } catch {
      setGeoError('Location search failed. Please click directly on the map.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      zIndexClassName="z-[60]"
      title={outletName ? `Set Location — ${outletName}` : 'Point Outlet Location on Map'}
      description="Click anywhere on the map or drag the pin to set the exact outlet GPS coordinates"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Selected Pin:</span>
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200 font-semibold">
              {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onConfirm({ latitude: currentLat, longitude: currentLng });
                onClose();
              }}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Confirm Location
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Search & Location Bar */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search neighborhood, street, or landmark..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                isLoading={isSearching}
                className="shrink-0 text-xs"
              >
                Search
              </Button>
            </form>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              isLoading={isLocating}
              leftIcon={<Crosshair className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />}
              className="shrink-0 text-xs"
            >
              Use My Location
            </Button>
          </div>

          {/* Search Result Dropdown */}
          {searchResults.length > 1 && (
            <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-md dark:border-slate-700 dark:bg-slate-800 max-h-40 overflow-y-auto space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-0.5">
                Select matching result:
              </div>
              {searchResults.map((item, index) => (
                <button
                  key={`${item.latitude}-${item.longitude}-${index}`}
                  type="button"
                  onClick={() => {
                    handleSetPosition(item.latitude, item.longitude);
                    setSearchResults([]);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-slate-700 dark:text-slate-200"
                >
                  <span className="truncate">{item.displayName || item.addressLine}</span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
              <Compass className="h-3 w-3" /> Quick:
            </span>
            {POPULAR_AREAS.map((area) => (
              <button
                key={area.name}
                type="button"
                onClick={() => handleSetPosition(area.lat, area.lng)}
                className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium shrink-0 transition-colors"
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>

        {geoError && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>{geoError}</span>
          </div>
        )}

        {/* Leaflet Map Canvas */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
          <div
            ref={mapContainerRef}
            className="w-full h-80 sm:h-96 bg-slate-100 dark:bg-slate-900"
            style={{ zIndex: 1 }}
          />

          {/* Floating Address Bar */}
          {detectedAddress && (
            <div className="absolute top-2 left-2 right-2 z-1000 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate text-slate-700 dark:text-slate-300">{detectedAddress}</span>
            </div>
          )}

          {/* Interactive instruction pill */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-1000 bg-slate-900/80 text-white text-[11px] font-medium px-3 py-1 rounded-full shadow-lg pointer-events-none select-none">
            Click map or drag the pin to place location
          </div>
        </div>
      </div>
    </Modal>
  );
};
