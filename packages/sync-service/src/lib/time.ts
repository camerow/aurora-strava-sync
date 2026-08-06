const AURORA_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/;

export function parseAuroraTime(s: string): Date {
  const m = AURORA_TIME.exec(s);
  if (!m) throw new Error(`unrecognised aurora timestamp ${JSON.stringify(s)}`);
  const [, y, mo, d, h, mi, sec] = m;
  return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +sec!));
}

export function wallClockNow(timezone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second")
    )
  );
}

export function toWallClockString(d: Date): string {
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}
