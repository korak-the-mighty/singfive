import { useEffect } from 'react';
import { Link, Redirect, Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { activeSlots, useStore } from './data/store';
import { About } from './pages/About';
import { Audition } from './pages/Audition';
import { ChangeSong } from './pages/ChangeSong';
import { FirstRead } from './pages/FirstRead';
import { FirstSing } from './pages/FirstSing';
import { Gallery } from './pages/Gallery';
import { Home } from './pages/Home';
import { Listen } from './pages/Listen';
import { PracticePage } from './pages/Practice';
import { SingAgain } from './pages/SingAgain';
import { Sixth } from './pages/Sixth';
import { SongPage } from './pages/SongPage';
import { Start } from './pages/Start';
import { Voice } from './pages/Voice';

export function useFirstSingDone(): { hasFive: boolean; done: boolean; next: number } {
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const five = activeSlots(slots);
  const idx = five.findIndex((s) => !takes.some((t) => t.songId === s.songId && t.committed && t.kind !== 'practice'));
  return { hasFive: five.length === 5, done: five.length === 5 && idx === -1, next: idx };
}

function TopBar() {
  const [loc] = useLocation();
  const { done } = useFirstSingDone();
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" aria-label="FIVE, home">
          <span className="five-mark">FIVE</span>
        </Link>
        {done && (
          <nav aria-label="Main">
            <Link href="/" aria-current={loc === '/' ? 'page' : undefined}>
              Your five
            </Link>
            <Link href="/voice" aria-current={loc === '/voice' ? 'page' : undefined}>
              Your voice
            </Link>
            <Link href="/about" aria-current={loc === '/about' ? 'page' : undefined}>
              Privacy
            </Link>
          </nav>
        )}
        {!done && (
          <nav aria-label="Main">
            <Link href="/about">Privacy</Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function HomeRoute() {
  const { hasFive, done, next } = useFirstSingDone();
  if (!hasFive) return <Start />;
  if (!done) return <Redirect to={`/first/${next}`} replace />;
  return <Home />;
}

function ScrollTop() {
  const [loc] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc]);
  return null;
}

export function App() {
  const loaded = useStore((s) => s.loaded);
  const init = useStore((s) => s.init);
  useEffect(() => {
    init().catch((e) => {
      console.error(e);
      useStore.setState({ loaded: true });
    });
  }, [init]);

  if (!loaded) return null;
  return (
    <Router hook={useHashLocation}>
      <ScrollTop />
      <TopBar />
      <main>
        <Switch>
          <Route path="/" component={HomeRoute} />
          <Route path="/choose" component={Start} />
          <Route path="/first/:i">{(p) => <FirstSing index={Number(p.i)} />}</Route>
          <Route path="/first-read" component={FirstRead} />
          <Route path="/song/:id">{(p) => <SongPage songId={p.id} />}</Route>
          <Route path="/song/:id/sing">{(p) => <SingAgain songId={p.id} />}</Route>
          <Route path="/song/:id/practice/:pid">{(p) => <PracticePage songId={p.id} practiceId={p.pid} />}</Route>
          <Route path="/song/:id/listen">{(p) => <Listen songId={p.id} />}</Route>
          <Route path="/change">{() => <ChangeSong songId={null} />}</Route>
          <Route path="/change/:id">{(p) => <ChangeSong songId={p.id} />}</Route>
          <Route path="/audition/:id">{(p) => <Audition candidateId={p.id} />}</Route>
          <Route path="/voice" component={Voice} />
          <Route path="/sixth" component={Sixth} />
          <Route path="/about" component={About} />
          {import.meta.env.DEV && <Route path="/gallery" component={Gallery} />}
          <Route>
            <div className="wrap narrow">
              <h2>That page doesn’t exist.</h2>
              <p className="mt16">
                <Link href="/">Back to your five songs</Link>
              </p>
            </div>
          </Route>
        </Switch>
      </main>
    </Router>
  );
}
