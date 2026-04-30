export type ConnectionState = 'idle' | 'testing' | 'ok' | 'error';

export function ConnectionBadge({
  state,
  message,
}: {
  state: ConnectionState;
  message?: string;
}) {
  const text =
    state === 'idle'
      ? 'Not tested'
      : state === 'testing'
        ? 'Testing…'
        : state === 'ok'
          ? 'Connected'
          : `Error: ${message ?? 'unknown'}`;
  const color =
    state === 'ok'
      ? 'text-accent-dim'
      : state === 'error'
        ? 'text-danger'
        : 'text-ink/60';
  return (
    <span role="status" className={`inline-block text-sm font-medium ${color}`}>
      {text}
    </span>
  );
}
