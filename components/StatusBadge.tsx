type Severity = 'info' | 'warning' | 'error' | 'critical';
type MuxStatus = 'active' | 'maintenance' | 'inactive';
type StreamStatus = 'active' | 'inactive' | 'error' | 'standby';
type SFNStatus = 'active' | 'maintenance' | 'inactive' | 'alarm';

const severityMap: Record<Severity, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800 font-semibold',
};

const muxStatusMap: Record<MuxStatus, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-orange-100 text-orange-700',
  inactive: 'bg-gray-100 text-gray-600',
};

const streamStatusMap: Record<StreamStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  error: 'bg-red-100 text-red-700',
  standby: 'bg-blue-100 text-blue-600',
};

const sfnStatusMap: Record<SFNStatus, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-orange-100 text-orange-700',
  inactive: 'bg-gray-100 text-gray-500',
  alarm: 'bg-red-100 text-red-700',
};

const labelMap: Record<string, string> = {
  active: 'Aktywny',
  maintenance: 'Konserwacja',
  inactive: 'Nieaktywny',
  error: 'Błąd',
  standby: 'Standby',
  alarm: 'Alarm',
  info: 'Info',
  warning: 'Ostrzeżenie',
  critical: 'Krytyczny',
};

interface Props {
  value: string;
  type?: 'mux' | 'stream' | 'sfn' | 'severity' | 'channel';
}

export default function StatusBadge({ value, type = 'mux' }: Props) {
  let cls = 'bg-gray-100 text-gray-600';
  if (type === 'mux') cls = muxStatusMap[value as MuxStatus] ?? cls;
  else if (type === 'stream') cls = streamStatusMap[value as StreamStatus] ?? cls;
  else if (type === 'sfn') cls = sfnStatusMap[value as SFNStatus] ?? cls;
  else if (type === 'severity') cls = severityMap[value as Severity] ?? cls;
  else if (type === 'channel') {
    if (value === 'active') cls = 'bg-green-100 text-green-700';
    else if (value === 'error') cls = 'bg-red-100 text-red-700';
    else cls = 'bg-gray-100 text-gray-500';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {labelMap[value] ?? value}
    </span>
  );
}
