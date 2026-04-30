import { SettingsPage } from './pages/SettingsPage.js';

export default function App() {
  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        <p className="text-sm opacity-70">Phase 3a — Settings only</p>
      </header>
      <main>
        <SettingsPage />
      </main>
    </div>
  );
}
