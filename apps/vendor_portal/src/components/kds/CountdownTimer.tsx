import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CountdownTimerProps {
  acceptedAt?: string | null;
  prepTimeMinutes?: number | null;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  acceptedAt,
  prepTimeMinutes = 20,
  className,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!acceptedAt || !prepTimeMinutes) return (prepTimeMinutes || 20) * 60;
    const start = new Date(acceptedAt).getTime();
    const target = start + prepTimeMinutes * 60 * 1000;
    return Math.floor((target - Date.now()) / 1000);
  });

  useEffect(() => {
    if (!acceptedAt) return;

    const interval = setInterval(() => {
      const start = new Date(acceptedAt).getTime();
      const target = start + (prepTimeMinutes || 20) * 60 * 1000;
      const diff = Math.floor((target - Date.now()) / 1000);
      setRemainingSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [acceptedAt, prepTimeMinutes]);

  const isOverdue = remainingSeconds < 0;
  const isUrgent = remainingSeconds <= 180 && !isOverdue; // Under 3 mins

  const formatTime = (seconds: number) => {
    const absSec = Math.abs(seconds);
    const mins = Math.floor(absSec / 60);
    const secs = absSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className={cn(
        'h-9 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold tracking-wide transition-colors shadow-xs select-none shrink-0',
        isOverdue
          ? 'bg-rose-100 text-rose-800 border-2 border-rose-400 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700 animate-pulse'
          : isUrgent
          ? 'bg-amber-100 text-amber-900 border-2 border-amber-400 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700'
          : 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
        className
      )}
    >
      {isOverdue ? (
        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="font-mono">
        {isOverdue
          ? `+${formatTime(remainingSeconds)} Overdue`
          : `${formatTime(remainingSeconds)} left`}
      </span>
    </div>
  );
};
