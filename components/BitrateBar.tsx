interface Props {
  used: number;
  total: number;
  label?: string;
  showNumbers?: boolean;
}

export default function BitrateBar({ used, total, label, showNumbers = true }: Props) {
  const pct = Math.min(100, total > 0 ? (used / total) * 100 : 0);
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-orange-400' : 'bg-blue-500';
  return (
    <div className="w-full">
      {(label || showNumbers) && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          {label && <span>{label}</span>}
          {showNumbers && <span className="ml-auto">{used.toFixed(1)} / {total.toFixed(1)} Mbps</span>}
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[10px] text-gray-400 mt-0.5">{pct.toFixed(0)}%</p>
    </div>
  );
}
