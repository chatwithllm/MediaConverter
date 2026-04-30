import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useEventStream } from '../../src/hooks/useEventStream.js';
import { pipelineStore } from '../../src/state/pipelineStore.js';

interface FakeES {
  addEventListener: (name: string, cb: (e: MessageEvent) => void) => void;
  close: () => void;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  dispatch: (name: string, data: unknown) => void;
}

let lastES: FakeES;

beforeEach(() => {
  pipelineStore.reset();
  class ES implements FakeES {
    private listeners = new Map<string, (e: MessageEvent) => void>();
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_url: string) {
      lastES = this;
      queueMicrotask(() => this.onopen?.());
    }
    addEventListener(name: string, cb: (e: MessageEvent) => void) {
      this.listeners.set(name, cb);
    }
    close() {
      this.listeners.clear();
    }
    dispatch(name: string, data: unknown) {
      const cb = this.listeners.get(name);
      if (cb) cb({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
  vi.stubGlobal('EventSource', ES);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const { snapshot, status } = useEventStream();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="count">{snapshot.size}</span>
    </div>
  );
}

describe('useEventStream', () => {
  it('updates store and re-renders on dispatched event', async () => {
    render(<Probe />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    await act(async () => {
      lastES.dispatch('pipeline', {
        fileId: 'a',
        title: 'A',
        stage: 'queued',
        ts: 1,
      });
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('reflects open status after onopen fires', async () => {
    render(<Probe />);
    await act(async () => {
      await Promise.resolve(); // let queueMicrotask flush
    });
    expect(screen.getByTestId('status')).toHaveTextContent('open');
  });
});
