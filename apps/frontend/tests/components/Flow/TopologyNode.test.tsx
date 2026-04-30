import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TopologyNode } from '../../../src/components/Flow/TopologyNode.js';

describe('TopologyNode', () => {
  it('renders label and count badge when active', () => {
    const { container } = render(
      <svg>
        <TopologyNode
          layout={{
            id: 'tdarr',
            label: 'Tdarr',
            sublabel: 'orchestrator',
            iconKey: 'tdarr',
            zone: 'orchestrator',
            x: 100,
            y: 100,
          }}
          active
          count={3}
        />
      </svg>,
    );
    expect(container.textContent).toContain('Tdarr');
    expect(container.textContent).toContain('3 active');
  });

  it('shows idle when count is 0', () => {
    const { container } = render(
      <svg>
        <TopologyNode
          layout={{
            id: 'truenas',
            label: 'TrueNAS',
            iconKey: 'truenas',
            zone: 'storage',
            x: 100,
            y: 100,
          }}
          active={false}
          count={0}
        />
      </svg>,
    );
    expect(container.textContent).toContain('idle');
  });
});
