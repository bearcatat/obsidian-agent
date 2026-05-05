export type TimeInfo = {
  timestamp: string;
  formatted: string;
  components: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
  timezone: string;
  weekday: string;
};

/**
 * 将Date对象转换为TimeInfo
 * @param date Date对象
 * @returns TimeInfo对象
 */
export function convertDateToTimeInfo(date: Date): TimeInfo {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 获取时间的各个组成部分
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() 返回 0-11，需要 +1
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  // 获取星期几
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekday = weekdays[date.getDay()];

  // 格式化时间字符串
  const formatted = formatTime(date, timezone);

  return {
    timestamp: date.toISOString(),
    formatted,
    components: {
      year,
      month,
      day,
      hour,
      minute,
      second,
    },
    timezone,
    weekday,
  };
}

/**
 * 格式化时间为本地化字符串
 * @param date Date对象
 * @param timezone 时区
 * @returns 格式化后的时间字符串
 */
function formatTime(date: Date, timezone: string): string {
  // 使用 Intl.DateTimeFormat 创建本地化的时间格式
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    hour12: false,
  });

  return formatter.format(date);
}
