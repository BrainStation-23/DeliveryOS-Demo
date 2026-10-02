import React from 'react';
import { Navigation } from 'lucide-react';
import { AdminOrder, FleetRider } from '../../../../services/adminApi';
import { Alert } from '../../../../components/ui/Alert';
import { LiveFleetMap } from '../../../../components/dispatch/LiveFleetMap';

export interface EscalationAlert {
  orderNumber: string;
  tier: number;
  agingSeconds: number;
  searchRadiusKm: number;
}

interface FleetRadarPanelProps {
  fleet: FleetRider[];
  unassignedOrders: AdminOrder[];
  onlineCount: number;
  selectedRiderId?: string;
  onSelectRider: (riderId: string) => void;
  escalation: EscalationAlert | null;
  onDismissEscalation: () => void;
}

export const FleetRadarPanel: React.FC<FleetRadarPanelProps> = ({
  fleet,
  unassignedOrders,
  onlineCount,
  selectedRiderId,
  onSelectRider,
  escalation,
  onDismissEscalation,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary-600" />
          Live Geographic Radar (Dhaka Zone)
        </h2>
        <p className="text-xs text-slate-500">
          Real-time telemetry showing {onlineCount} active couriers and {unassignedOrders.length} unassigned
          order pickup targets.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 self-start sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Telemetry
      </span>
    </div>

    {escalation && (
      <div className="mb-4">
        <Alert
          type="error"
          title={`Urgent Dispatch Escalation (Tier ${escalation.tier})`}
          message={`Order ${escalation.orderNumber} has been waiting ${escalation.agingSeconds}s! Search radius expanded to ${escalation.searchRadiusKm}km.`}
          onDismiss={onDismissEscalation}
        />
      </div>
    )}

    <LiveFleetMap
      fleet={fleet}
      unassignedOrders={unassignedOrders}
      selectedRiderId={selectedRiderId}
      onSelectRider={onSelectRider}
    />
  </div>
);
