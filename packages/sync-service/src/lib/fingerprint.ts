export function fingerprint(boardUserId: number, firstClimbTime: Date): string {
  return `${boardUserId}-${Math.floor(firstClimbTime.getTime() / 1000)}`;
}
