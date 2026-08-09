export type ClimbKind = "send" | "attempt";

export type Climb = {
  time: Date;
  vGrade: number;
  name: string;
  kind: ClimbKind;
  tries: number;
  angle?: number;
};

export type Session = {
  start: Date;
  end: Date;
  climbs: Climb[];
  inProgress: boolean;
};

export type SessionConfig = {
  gapMs: number;
  warmupBufferMs: number;
  cooldownBufferMs: number;
  inProgressWindowMs: number;
};

const MINUTE = 60_000;

export function defaultSessionConfig(): SessionConfig {
  return {
    gapMs: 90 * MINUTE,
    warmupBufferMs: 10 * MINUTE,
    cooldownBufferMs: 5 * MINUTE,
    inProgressWindowMs: 120 * MINUTE,
  };
}

export function isInProgress(end: Date, cfg: SessionConfig, now: Date): boolean {
  return now.getTime() - (end.getTime() - cfg.cooldownBufferMs) < cfg.inProgressWindowMs;
}

export function buildSessions(climbs: Climb[], cfg: SessionConfig, now: Date): Session[] {
  if (climbs.length === 0) return [];
  const sorted = [...climbs].sort((a, b) => a.time.getTime() - b.time.getTime());

  const sessions: Session[] = [];
  let group: Climb[] = [sorted[0]!];
  const flush = (): void => {
    const last = group[group.length - 1]!;
    const end = new Date(last.time.getTime() + cfg.cooldownBufferMs);
    sessions.push({
      start: new Date(group[0]!.time.getTime() - cfg.warmupBufferMs),
      end,
      climbs: group,
      inProgress: isInProgress(end, cfg, now),
    });
  };
  for (const c of sorted.slice(1)) {
    if (c.time.getTime() - group[group.length - 1]!.time.getTime() > cfg.gapMs) {
      flush();
      group = [];
    }
    group.push(c);
  }
  flush();
  return sessions;
}
