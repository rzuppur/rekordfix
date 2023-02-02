export function formatSeconds(seconds: string | number): string {
  return `${Math.floor(+seconds / 60)}:${(+seconds % 60).toString(10).padStart(2, "0")}`;
}
