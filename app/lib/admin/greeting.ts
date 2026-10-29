/** "Good morning" before 12:00, "Good afternoon" before 18:00, otherwise "Good evening". */
export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
