const weekdayIndex = new Map<string, number>([
  ["sun", 0],
  ["mon", 1],
  ["tue", 2],
  ["wed", 3],
  ["thu", 4],
  ["fri", 5],
  ["sat", 6],
]);

function getDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getWeekday(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  })
    .format(date)
    .toLowerCase();

  return weekdayIndex.get(weekday) ?? 0;
}

function formatKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseOffsetMinutes(offsetLabel: string) {
  if (offsetLabel === "GMT" || offsetLabel === "UTC") {
    return 0;
  }

  const match = offsetLabel.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unsupported timezone offset label: ${offsetLabel}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offsetLabel =
    formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "UTC";

  return parseOffsetMinutes(offsetLabel);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
  const firstOffset = getOffsetMinutes(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - firstOffset * 60_000);
  const secondOffset = getOffsetMinutes(firstPass, timeZone);

  if (secondOffset === firstOffset) {
    return firstPass;
  }

  return new Date(utcGuess.getTime() - secondOffset * 60_000);
}

export function getLocalDateKey(date: Date, timeZone: string) {
  const parts = getDateParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getWeekKey(date: Date, timeZone: string) {
  const parts = getDateParts(date, timeZone);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = getWeekday(date, timeZone);
  const daysSinceMonday = (weekday + 6) % 7;

  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return formatKey(localDate);
}

export function isDateOnOrAfterWeekKey(date: Date, weekKey: string, timeZone: string) {
  return getLocalDateKey(date, timeZone) >= weekKey;
}

export function getLocalDayBounds(date: Date, timeZone: string) {
  const parts = getDateParts(date, timeZone);

  return {
    start: zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0, timeZone),
    end: zonedDateTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, 999, timeZone),
  };
}
