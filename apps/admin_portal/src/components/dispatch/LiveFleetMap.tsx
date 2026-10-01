import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { FleetRider, AdminOrder } from '../../services/adminApi';

interface LiveFleetMapProps {
  fleet: FleetRider[];
  unassignedOrders: AdminOrder[];
  selectedRiderId?: string | null;
  onSelectRider?: (riderId: string) => void;
}

export const LiveFleetMap: React.FC<LiveFleetMapProps> = ({
  fleet,
  unassignedOrders,
  selectedRiderId,
  onSelectRider,
}) => {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const defaultCenter: [number, number] = [23.7925, 90.4078];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    const safeFleet = Array.isArray(fleet) ? fleet : [];
    const safeOrders = Array.isArray(unassignedOrders) ? unassignedOrders : [];

    safeFleet.forEach((rider) => {
      // Riders without a GPS fix are not plotted.
      if (!rider || rider.latitude == null || rider.longitude == null) return;
      const lat = rider.latitude;
      const lng = rider.longitude;
      bounds.push([lat, lng]);

      const isWarning = (rider.cashInHand || 0) >= (rider.maxCashLimit || 5000);
      const isTrip = rider.status === 'ON_TRIP';
      const isOnline = rider.status === 'ONLINE';

      const statusBgClass = isWarning
        ? 'bg-brand-orange'
        : isTrip
          ? 'bg-sky-600'
          : isOnline
            ? 'bg-status-success'
            : 'bg-surface-500';

      const statusTextClass = isWarning
        ? 'text-brand-orange'
        : isTrip
          ? 'text-sky-600'
          : isOnline
            ? 'text-status-success'
            : 'text-surface-500';

      const customIcon = L.divIcon({
        className: 'custom-courier-pin',
        html: `
          <div class="relative w-8 h-8 ${statusBgClass} border-2 border-white rounded-full flex items-center justify-center shadow-md cursor-pointer select-none">
            <span class="text-sm">🛵</span>
            ${isTrip ? '<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-sky-400 border-2 border-white rounded-full"></span>' : ''}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupContent = `
        <div class="font-sans text-xs p-1 min-w-[160px]">
          <div class="font-bold text-sm mb-0.5 text-slate-900">${rider.riderName}</div>
          <div class="text-slate-500 mb-1.5">${rider.phone} • ${rider.vehicleType}</div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-500">Status:</span>
            <strong class="${statusTextClass}">${rider.status.replace('_', ' ')}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Cash in Hand:</span>
            <strong class="text-slate-900">৳${(rider.cashInHand || 0).toFixed(0)}</strong>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (onSelectRider) onSelectRider(rider.id);
      });

      marker.addTo(layer);
    });

    // Pins sit at the real vendor pickup coordinates; orders without a known
    // vendor location are skipped rather than drawn at fabricated positions.
    safeOrders
      .filter((order) => order && typeof order.vendorLatitude === 'number' && typeof order.vendorLongitude === 'number')
      .forEach((order) => {
      const lat = order.vendorLatitude as number;
      const lng = order.vendorLongitude as number;
      bounds.push([lat, lng]);

      const orderIcon = L.divIcon({
        className: 'custom-order-pin',
        html: `
          <div class="relative w-7 h-7 bg-brand-amber border-2 border-white rounded-md flex items-center justify-center shadow-md select-none">
            <span class="text-xs">📦</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon: orderIcon });
      const popupDiv = document.createElement('div');
      popupDiv.className = 'font-sans text-xs p-1 min-w-[170px]';
      popupDiv.innerHTML = `
        <div class="font-bold text-amber-700 mb-0.5">Waiting for Courier</div>
        <div class="font-semibold text-sm text-slate-900">${order.orderNumber}</div>
        <div class="text-slate-500 mb-1">${order.vendorName}</div>
        <div class="text-slate-900 font-bold mb-1.5">৳${order.totalAmount}</div>
      `;
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open Order →';
      openBtn.className = 'text-primary-600 font-semibold underline text-xs p-0 bg-transparent border-none cursor-pointer hover:text-primary-700';
      openBtn.onclick = (e) => {
        e.preventDefault();
        navigate(`/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`);
      };
      popupDiv.appendChild(openBtn);

      marker.bindPopup(popupDiv);
      marker.addTo(layer);
    });

    if (bounds.length > 1 && !selectedRiderId) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
    }
  }, [fleet, unassignedOrders, selectedRiderId, onSelectRider, navigate]);

  return (
    <div className="relative w-full h-[300px] sm:h-[380px] lg:h-[440px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute bottom-3 left-3 z-[500] bg-white/95 backdrop-blur-sm dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-md text-[11px] space-y-1.5">
        <div className="font-semibold text-slate-700 dark:text-slate-300">Fleet Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span className="text-slate-600 dark:text-slate-400">Idle & Ready</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
          <span className="text-slate-600 dark:text-slate-400">On Active Trip</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span className="text-slate-600 dark:text-slate-400">Unassigned Order</span>
        </div>
      </div>
    </div>
  );
};
