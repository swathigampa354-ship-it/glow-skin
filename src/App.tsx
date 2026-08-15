import { useCallback, useEffect, useRef, useState } from 'react';
import { fullScan, hasKey, type ScanResult } from './lib/youcam';
import { demoScan } from './lib/demo';
import { generateRoutine, seasonFromColors, beautyTips, type Routine } from './lib/routine';
import { loadHistory, saveHistory, toEntry, type HistoryEntry } from './lib/store';

type Phase = 'landing' | 'analyzing' | 'results';

const CONCERN_LABELS: Record<string, string> = {
  wrinkle: 'Wrinkles', droopy_upper_eyelid: 'Upper eyelids', droopy_lower_eyelid: 'Lower eyelids',
  firmness: 'Firmness', acne: 'Acne', moisture: 'Moisture', eye_bag: 'Eye bags',
  dark_circle_v2: 'Dark circles', age_spot: 'Age spots', radiance: 'Radiance',
  redness: 'Redness', oiliness: 'Oiliness', pore: 'Pores', texture: 'Texture',
};
const FITZ_INFO: Record<string, string> = {
  I: 'Burns easily, never tans', II: 'Burns, tans minimally', III: 'Sometimes burns, tans gradually',
  IV: 'Rarely burns, tans easily', V: 'Very rarely burns', VI: 'Almost never burns',
};
const scoreColor = (s: number) => (s >= 85 ? '#34c759' : s >= 70 ? '#ff9f0a' : '#ff3b30'); // iOS green/orange/red

export default function App() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgBlob, setImgBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeMask, setActiveMask] = useState<string | null>(null);
  const [tab, setTab] = useState<'report' | 'routine' | 'history'>('report');
  const [tips, setTips] = useState<string[]>([]);
  const [season, setSeason] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setImgBlob(f);
    setImgUrl(URL.createObjectURL(f));
    setPhase('analyzing');
  };

  const runDemo = () => {
    setError(null);
    setImgUrl(null); setImgBlob(null);
    setPhase('analyzing');
    setTimeout(() => {
      const r = demoScan();
      setResult(r); setRoutine(generateRoutine(r.scores, r.fitzpatrick));
      setTips(beautyTips(r.scores));
      setSeason(seasonFromColors(r.colors, r.tone));
      setTab('report'); setPhase('results');
      const entry = toEntry(r);
      const next = [entry, ...history].slice(0, 20);
      setHistory(next); saveHistory(next);
    }, 2500);
  };

  const analyze = useCallback(async () => {
    if (!imgBlob || busy) return;
    setBusy(true); setError(null);
    try {
      const r = hasKey() ? await fullScan(imgBlob) : demoScan();
      setResult(r);
      setRoutine(generateRoutine(r.scores, r.fitzpatrick));
      setTips(beautyTips(r.scores));
      setSeason(seasonFromColors(r.colors, r.tone));
      setTab('report'); setPhase('results');
      const entry = toEntry(r);
      setHistory((h) => {
        const next = [entry, ...h].slice(0, 20);
        saveHistory(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('landing');
    } finally {
      setBusy(false);
    }
  }, [imgBlob, busy]);

  // auto-analyze once image chosen
  useEffect(() => {
    if (phase === 'analyzing' && imgBlob) void analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, imgBlob]);

  const reset = () => { setPhase('landing'); setResult(null); setImgUrl(null); setImgBlob(null); setError(null); setActiveMask(null); };

  const maskList = result ? Object.entries(result.masks).filter(([, urls]) => urls.length) : [];
  const prev = history[1];

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">✨ Glow</span>
        <span className="tag">AI SKIN INTELLIGENCE</span>
        <span className="top-right">
          {!hasKey() && <span className="demo-badge">demo mode</span>}
          <button
            className="icon-btn"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </span>
      </header>

      <main className="wrap">
        {phase === 'landing' && (
          <section className="hero">
            <h1 className="hero-title">Know your skin.<br /><em>Not a guess.</em></h1>
            <p className="hero-sub">
              Upload a selfie and get a full AI skin report in ~30 seconds — 14 concern scores with
              visual masks, your skin age, sun type, exact tone, and a routine built from your real results.
            </p>
            <div className="steps">
              <span>📸 Selfie</span>→<span>🧪 AI analysis</span>→<span>📋 Report + routine</span>→<span>📈 Progress</span>
            </div>
            <div className="cta-row">
              <button className="btn-primary" onClick={() => inputRef.current?.click()}>Upload a selfie</button>
              <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              <button className="btn-ghost" onClick={runDemo}>Try demo (no photo)</button>
            </div>
            <div className="chips">
              <span>🔒 Nothing stored</span><span>⚡ ~30s</span><span>🧬 3 AI analyses</span>
            </div>
            {error && <div className="error">⚠ {error}</div>}
          </section>
        )}

        {phase === 'analyzing' && (
          <section className="analyzing">
            {imgUrl && <img src={imgUrl} alt="selfie" className="selfie-preview" />}
            <div className="spinner" />
            <h2>Analyzing your skin…</h2>
            <p className="muted">{hasKey() ? 'Running YouCam skin-analysis · tone · Fitzpatrick (14 concerns)' : 'Demo analysis — add a YouCam key for real results'}</p>
          </section>
        )}

        {phase === 'results' && result && routine && (
          <section className="results animate-rise">
            <div className="results-head">
              <div>
                <h2 className="results-title">Your skin report</h2>
                <p className="muted">{result.provider === 'youcam' ? '✨ Real YouCam AI analysis' : '🎬 Demo analysis'} · {Math.round(result.tookMs / 1000)}s</p>
              </div>
              <div className="head-actions">
                <button className="btn-ghost small" onClick={async () => {
                  const text = `My Glow skin report: ${result.overall ?? '—'}/100 · skin age ${result.skinAge ?? '—'} · Fitzpatrick ${result.fitzpatrick ?? '—'} · top concern ${Object.entries(result.scores).sort((a,b)=>a[1]-b[1])[0]?.[0] ?? '—'} ✨`;
                  try {
                    if (navigator.share) await navigator.share({ title: 'Glow — my skin report', text });
                    else { await navigator.clipboard.writeText(text); alert('Copied!'); }
                  } catch {}
                }}>📤 Share</button>
                <button className="btn-ghost small" onClick={reset}>← New scan</button>
              </div>
            </div>

            {/* summary cards */}
            <div className="summary">
              <div className="sum-card score">
                <div className="ring" style={{ background: `conic-gradient(${scoreColor(result.overall ?? 0)} ${(result.overall ?? 0) * 3.6}deg, #eee 0deg)` }}>
                  <div className="ring-inner"><b>{result.overall ?? '—'}</b><span>overall</span></div>
                </div>
              </div>
              <div className="sum-card"><b className="big">{result.skinAge ?? '—'}</b><span>Skin age</span></div>
              <div className="sum-card">
                <b className="big">{result.fitzpatrick ?? '—'}</b><span>Fitzpatrick</span>
                <small>{result.fitzpatrick ? FITZ_INFO[result.fitzpatrick] : ''}</small>
              </div>
              <div className="sum-card">
                <span className="tone-dot" style={{ background: result.tone ?? '#ccc' }} />
                <b className="big" style={{ fontSize: 15 }}>{result.tone ?? '—'}</b><span>Skin tone</span>
              </div>
            </div>

            {/* tabs */}
            <div className="tabs">
              {(['report', 'routine', 'history'] as const).map((t) => (
                <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                  {t === 'report' ? '📋 Report' : t === 'routine' ? '🧴 Routine' : '📈 Progress'}
                </button>
              ))}
            </div>

            {tab === 'report' && (
              <>
                <div className="grid">
                  {Object.entries(result.scores).map(([k, s]) => (
                    <div key={k} className={`concern ${activeMask === (result.masks[k]?.[0] ?? '') ? 'active' : ''}`}
                      onClick={() => {
                        const m = result.masks[k]?.[0];
                        if (m) setActiveMask(activeMask === m ? null : m);
                      }}>
                      <div className="concern-top"><span>{CONCERN_LABELS[k] ?? k}</span><b style={{ color: scoreColor(s) }}>{Math.round(s)}</b></div>
                      <div className="bar"><div style={{ width: `${s}%`, background: scoreColor(s) }} /></div>
                      {result.masks[k]?.length ? <small className="mask-hint">tap to see mask</small> : null}
                    </div>
                  ))}
                </div>
                {activeMask && (
                  <div className="mask-view">
                    <img src={activeMask} alt="detection mask" />
                    <button className="btn-ghost small" onClick={() => setActiveMask(null)}>Hide mask</button>
                  </div>
                )}
                {maskList.length === 0 && <p className="muted center">Masks appear with real analysis (demo mode has no masks).</p>}
                <div className="colors">
                  {Object.entries(result.colors).map(([k, v]) => (
                    <span key={k} className="color-chip"><i style={{ background: v }} />{k}: {v}</span>
                  ))}
                </div>
                {season && (
                  <div className="season-card">
                    <b>🎨 Your color season:</b> {season}
                  </div>
                )}
                {tips.length > 0 && (
                  <div className="tips-card">
                    <b>💡 Quick glow-up tips</b>
                    <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
              </>
            )}

            {tab === 'routine' && (
              <div className="routine">
                <p className="muted">Built from your scores — higher concern = prioritized step.</p>
                {routine.focus.length > 0 && (
                  <div className="focus"><b>Focus areas:</b> {routine.focus.join(' · ')}</div>
                )}
                <div className="routine-cols">
                  <div className="routine-col"><h3>☀️ Morning</h3><ul>{routine.am.map((s) => <li key={s}>{s}</li>)}</ul></div>
                  <div className="routine-col"><h3>🌙 Night</h3><ul>{routine.pm.map((s) => <li key={s}>{s}</li>)}</ul></div>
                </div>
                {routine.weekly.length > 0 && (
                  <div className="routine-weekly"><b>🗓 Weekly:</b> {routine.weekly.join(' · ')}</div>
                )}
                <div className="disclaimer">Routine is educational, generated by rules from your scores — not medical advice.</div>
              </div>
            )}

            {tab === 'history' && (
              <div className="history">
                {history.length === 0 && <p className="muted center">No scans yet.</p>}
                {history.length > 0 && (
                  <>
                    <div className="history-list">
                      {history.map((h, i) => (
                        <div key={h.id} className="hist-item">
                          <span className="hist-date">{new Date(h.ts).toLocaleDateString()} {new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="hist-score" style={{ color: scoreColor(h.overall ?? 0) }}>{h.overall ?? '—'}</span>
                          <span className="hist-meta">age {h.skinAge ?? '—'} · type {h.fitzpatrick ?? '—'}</span>
                          {i === 0 && <span className="badge-new">latest</span>}
                        </div>
                      ))}
                    </div>
                    {history.length >= 2 && (
                      <div className="spark">
                        <b>Trend</b>
                        <div className="spark-bars">
                          {[...history].reverse().map((h) => (
                            <span key={h.id} style={{ height: `${h.overall ?? 0}%` }} title={`${h.overall}`} />
                          ))}
                        </div>
                        <small>{history[0].overall} → {history[history.length - 1].overall}</small>
                      </div>
                    )}
                    {prev && result.overall !== null && prev.overall !== null && (
                      <div className="progress">
                        <b>Progress:</b> {prev.overall} → {result.overall}
                        <span style={{ color: result.overall >= prev.overall ? '#16a34a' : '#dc2626' }}>
                          {result.overall >= prev.overall ? ' ▲ improving' : ' ▼ (retinol takes weeks — keep going)'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        Glow · AI Skin Intelligence · powered by YouCam (skin-analysis · skin-tone-analysis · fitzpatrick) · built for the YouCam API Hackathon
      </footer>
    </div>
  );
}
