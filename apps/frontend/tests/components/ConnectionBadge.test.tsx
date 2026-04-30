import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionBadge } from '../../src/components/Settings/ConnectionBadge.js';

describe('ConnectionBadge', () => {
  it('renders idle state', () => {
    render(<ConnectionBadge state="idle" />);
    expect(screen.getByRole('status')).toHaveTextContent(/not tested/i);
  });

  it('renders ok state', () => {
    render(<ConnectionBadge state="ok" />);
    expect(screen.getByRole('status')).toHaveTextContent(/connected/i);
  });

  it('renders error state with message', () => {
    render(<ConnectionBadge state="error" message="path does not exist" />);
    expect(screen.getByRole('status')).toHaveTextContent(/path does not exist/i);
  });
});
