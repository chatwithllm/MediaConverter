import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TopologyNode } from '../../../src/components/Flow/TopologyNode.js';

describe('TopologyNode', () => {
  it('renders label and count', () => {
    const { container } = render(
      <svg>
        <TopologyNode
          layout={{ id: 'tdarr', label: 'Tdarr', icon: '🎛️', x: 100, y: 100 }}
          active
          count={3}
        />
      </svg>,
    );
    expect(container.textContent).toContain('Tdarr');
    expect(container.textContent).toContain('3 active');
  });
});
