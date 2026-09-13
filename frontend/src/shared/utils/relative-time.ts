export function formatRelativeTime(ts: number, now = Date.now()): string {
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 45) return 'a few seconds ago';
  if (sec < 90) return 'a minute ago';
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  if (sec < 5400) return 'an hour ago';
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 172800) return 'yesterday';
  return `${Math.floor(sec / 86400)} days ago`;
}
