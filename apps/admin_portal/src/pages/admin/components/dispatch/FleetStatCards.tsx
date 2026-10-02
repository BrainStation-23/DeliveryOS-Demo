import React from 'react';
import { Bike, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { StatCard } from '../../../../components/common/StatCard';
import { FleetStats } from './fleetFilters';

interface FleetStatCardsProps {
  stats: FleetStats;
  totalRiders: number;
  isLoading: boolean;
  applicantsFilterActive: boolean;
  onToggleApplicantsFilter: () => void;
}

export const FleetStatCards: React.FC<FleetStatCardsProps> = ({
  stats,
  totalRiders,
  isLoading,
  applicantsFilterActive,
  onToggleApplicantsFilter,
}) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <StatCard
      title="Online Riders"
      value={stats.onlineCount}
      subtitle={`/ ${totalRiders} total`}
      icon={Bike}
      iconColorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
      isLoading={isLoading}
    />
    <StatCard
      title="On Delivery"
      value={stats.onTripCount}
      subtitle="moving orders"
      icon={Bike}
      iconColorClass="text-sky-600 bg-sky-50 dark:bg-sky-950/50"
      isLoading={isLoading}
    />
    <StatCard
      title="Idle & Ready"
      value={stats.idleCount}
      subtitle="for dispatch"
      icon={CheckCircle2}
      iconColorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
      isLoading={isLoading}
    />
    <StatCard
      title="Cash Warnings"
      value={stats.safetyWarningsCount}
      subtitle="near limit"
      icon={AlertTriangle}
      iconColorClass={
        stats.safetyWarningsCount > 0
          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50'
          : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
      }
      isLoading={isLoading}
    />
    <StatCard
      title="Applicants"
      value={stats.pendingApplicantsCount}
      subtitle="pending review"
      icon={Users}
      iconColorClass="text-amber-600 bg-amber-50 dark:bg-amber-950/50"
      active={applicantsFilterActive}
      onClick={onToggleApplicantsFilter}
      isLoading={isLoading}
    />
  </div>
);
