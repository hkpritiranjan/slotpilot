export interface ApptType {
  name: string;
  durationMins: number;
  fee: number;
}

export function parseApptTypes(raw: string): ApptType[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed[0]?.name !== undefined) return parsed as ApptType[];
  } catch {}
  // Legacy CSV format
  return raw.split(",").map((s) => ({ name: s.trim(), durationMins: 30, fee: 0 }));
}

export function serializeApptTypes(types: ApptType[]): string {
  return JSON.stringify(types);
}

export function feeByTypeName(types: ApptType[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const t of types) m[t.name] = t.fee;
  return m;
}
