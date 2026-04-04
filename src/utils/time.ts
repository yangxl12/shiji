export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '刚刚';
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} 分钟前`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} 小时前`;
  }

  const date = new Date(timestamp);
  const yesterday = new Date(now - day);
  const dayBeforeYesterday = new Date(now - 2 * day);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, yesterday)) {
    return `昨天 ${formatTime(date)}`;
  }

  if (isSameDay(date, dayBeforeYesterday)) {
    return `前天 ${formatTime(date)}`;
  }

  const daysDiff = Math.floor(diff / day);
  if (daysDiff < 7) {
    return `${daysDiff} 天前`;
  }

  return formatDateTime(date);
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
