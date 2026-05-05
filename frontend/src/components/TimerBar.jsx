import { useState, useEffect } from 'react';

const EXTEND_MINUTES = 10;

function formatDuration(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function TimerBar({ expiresAt, onExtend }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [extending, setExtending] = useState(false);
  const [extended, setExtended] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const exp = new Date(expiresAt).getTime();
    const remaining = exp - Date.now();
    setTotalMs((prev) => (remaining > prev ? remaining : prev || remaining));
    setTimeLeft(Math.max(0, remaining));

    const interval = setInterval(() => {
      const left = Math.max(0, exp - Date.now());
      setTimeLeft(left);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleExtend = async () => {
    setExtending(true);
    try {
      await onExtend(EXTEND_MINUTES);
      setTotalMs((prev) => prev + EXTEND_MINUTES * 60 * 1000);
      setExtended(true);
      setTimeout(() => setExtended(false), 3000);
    } catch {}
    setExtending(false);
  };

  const percent = totalMs > 0 ? (timeLeft / totalMs) * 100 : 0;
  const isWarning = timeLeft < 5 * 60 * 1000;  // < 5 min
  const isCritical = timeLeft < 2 * 60 * 1000; // < 2 min

  const barColor = isCritical
    ? 'from-red-600 to-red-500'
    : isWarning
    ? 'from-amber-600 to-amber-500'
    : 'from-kurumi-600 to-purple-600';

  const textColor = isCritical
    ? 'text-red-400'
    : isWarning
    ? 'text-amber-400'
    : 'text-kurumi-400';

  return (
    <div className="glass-sm px-4 py-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-slate-500">Inbox expires in</span>
          <span className={`text-sm font-mono font-semibold tabular-nums ${textColor} ${isCritical ? 'animate-pulse' : ''}`}>
            {formatDuration(timeLeft)}
          </span>
        </div>

        <button
          onClick={handleExtend}
          disabled={extending}
          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium transition-all active:scale-95
            ${extended
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-white/[0.05] text-slate-400 hover:bg-kurumi-500/20 hover:text-kurumi-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {extending ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          )}
          {extended ? 'Extended!' : `+${EXTEND_MINUTES} min`}
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-dark-600/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
