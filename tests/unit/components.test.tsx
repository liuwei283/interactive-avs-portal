import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Markdown } from '../../src/components/content/Markdown';
import { MetricTable } from '../../src/components/media/MetricTable';
import type { ExperimentMetric } from '../../src/lib/types';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Markdown', () => {
  it('renders GFM tables, math and internal links', () => {
    const { container } = wrap(
      <Markdown>{'| a | b |\n|---|---|\n| 1 | 2 |\n\n$A = F(O_1, O_2, I(t))$\n\nSee [run](exp:EXP-0001) and [week](week:2026-11-02).'}</Markdown>,
    );
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(screen.getByText('run').getAttribute('href')).toBe('/experiments/EXP-0001');
    expect(screen.getByText('week').getAttribute('href')).toBe('/progress/2026-11-02');
  });
  it('does not render raw HTML or javascript: links', () => {
    const { container } = wrap(<Markdown>{'<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))'}</Markdown>);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    const a = screen.getByText('x');
    expect(a.getAttribute('href') ?? '').not.toMatch(/javascript/);
  });
});

describe('MetricTable', () => {
  const m = (o: Partial<ExperimentMetric>): ExperimentMetric => ({
    id: Math.random().toString(), experiment_id: 'e', metric_name: 'FAD', condition_label: '', is_baseline: false, value: null, unit: '',
    higher_is_better: false, split: 'test', notes: '', sort_order: 0, created_at: '', ...o,
  });
  it('pivots conditions × metrics and marks the best value only when direction is known', () => {
    wrap(<MetricTable metrics={[m({ condition_label: 'Ours', value: 1.5 }), m({ condition_label: 'Baseline', value: 2.5, is_baseline: true })]} />);
    expect(screen.getByText('Ours')).toBeInTheDocument();
    expect(screen.getByText('baseline')).toBeInTheDocument();
    expect(screen.getByText('(best)')).toBeInTheDocument();
    expect(screen.getByText(/FAD/)).toHaveTextContent('↓');
  });
  it('renders nothing without metrics', () => {
    const { container } = wrap(<MetricTable metrics={[]} />);
    expect(container.querySelector('table')).toBeNull();
  });
});
