import { describe, expect, it } from 'vitest';
import { collectRefs, isMonday, mondayOf, parseWeekFile, transformRefs } from '../../scripts/lib/week-report.mjs';

const SAMPLE = `---
week_start: 2026-11-09
title: Test week
components: [a, b]
---
## Results
![Loss curve](figs/loss.png) and [raw log](logs/run.json) and [paper](https://arxiv.org/abs/1) and [exp](exp:EXP-1)

\`\`\`compare-audio
title: Same video, two models
Ours: audio/ours.wav
Baseline: MMAudio: audio/base.wav
\`\`\`

\`\`\`gallery
figs/a.png | Frame 1
figs/b.png
\`\`\`

\`\`\`metrics
title: Table
csv: results/m.csv
\`\`\`

\`\`\`python
x = "figs/not_a_ref.png"
\`\`\`
`;

describe('week report parsing', () => {
  it('parses front matter (dates stay ISO strings)', () => {
    const { meta, body } = parseWeekFile(SAMPLE);
    expect(meta).toMatchObject({ week_start: '2026-11-09', title: 'Test week', components: ['a', 'b'] });
    expect(body.startsWith('## Results')).toBe(true);
  });

  it('collects only local references, including block items and csv', () => {
    const refs = collectRefs(parseWeekFile(SAMPLE).body).map((r) => `${r.kind}:${r.ref}`);
    expect(refs).toEqual([
      'link:figs/loss.png', 'link:logs/run.json',
      'media:audio/ours.wav', 'media:audio/base.wav',
      'media:figs/a.png', 'media:figs/b.png',
      'csv:results/m.csv',
    ]);
  });

  it('rewrites refs to asset ids, keeps labels with colons, inlines csv', () => {
    const out = transformRefs(parseWeekFile(SAMPLE).body, (ref, kind) => (kind === 'csv' ? 'cond,FAD\nOurs,1.0' : `asset:id-${ref.replace(/\W/g, '')}`));
    expect(out).toContain('![Loss curve](asset:id-figslosspng)');
    expect(out).toContain('[paper](https://arxiv.org/abs/1)');
    expect(out).toContain('Baseline: MMAudio: asset:id-audiobasewav');
    expect(out).toContain('asset:id-figsapng | Frame 1');
    expect(out).toContain('cond,FAD\nOurs,1.0');
    expect(out).not.toContain('csv: results');
    expect(out).toContain('x = "figs/not_a_ref.png"');
  });

  it('handles Monday checks', () => {
    expect(isMonday('2026-11-09')).toBe(true);
    expect(isMonday('2026-11-12')).toBe(false);
    expect(mondayOf('2026-11-12')).toBe('2026-11-09');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
  });
});
