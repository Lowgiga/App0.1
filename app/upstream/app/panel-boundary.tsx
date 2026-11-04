'use client';
import { Component, Suspense, type ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

class PanelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="panel module-state" role="alert">
      <AlertCircle size={25} /><h2>Dieser Bereich konnte nicht geladen werden.</h2>
      <p>Dein gespeicherter Arbeitsstand bleibt erhalten. Ein Neuladen verwirft noch nicht gespeicherte Eingaben.</p>
      <Button variant="outline" onClick={() => location.reload()}>Seite neu laden</Button>
    </section>;
    return this.props.children;
  }
}

export default function PanelBoundary({ children }: { children: ReactNode }) {
  return <PanelErrorBoundary><Suspense fallback={<section className="panel module-state" role="status">
    <LoaderCircle size={23} className="module-spinner" /><strong>Arbeitsbereich wird geöffnet …</strong>
  </section>}>{children}</Suspense></PanelErrorBoundary>;
}
