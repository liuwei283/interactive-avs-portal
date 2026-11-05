export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(s);
}

export function isValidExperimentCode(s: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s);
}

/** Suggest the next "EXP-0007"-style code given existing codes. */
export function nextExperimentCode(existing: string[], prefix = 'EXP-'): string {
  let max = 0;
  for (const code of existing) {
    const m = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`).exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export function parseTags(input: string): string[] {
  return Array.from(new Set(input.split(',').map((t) => t.trim()).filter(Boolean)));
}
