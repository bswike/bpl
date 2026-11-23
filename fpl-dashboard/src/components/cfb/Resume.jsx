import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmtDate, rec, useCfb } from './data';
import { Status } from './ui';

// Each answer is one option index; the URL keeps them as ?r=111111111 so rankings can be shared.
const QUESTIONS = [
  { sec: 'Wins', key: 'winGood', q: 'Wins over teams with winning records', opts: [['No extra credit', 0], ['Some extra', 0.5], ['Big boost', 1]] },
  { sec: 'Wins', key: 'ranked', q: 'Wins over AP-ranked teams', opts: [['No extra credit', 0], ['Some extra', 0.75], ['Big boost', 1.5]] },
  { sec: 'Wins', key: 'faded', q: 'A win over a team that was ranked then but isn’t now', opts: [['Still a ranked win', 'then'], ['Counts half', 'half'], ['Not a ranked win', 'now']] },
  { sec: 'Wins', key: 'talentUp', q: 'Wins over teams with more roster talent than yours (247)', opts: [['No extra credit', 0], ['Some extra', 0.4], ['Big boost', 0.8]] },
  { sec: 'Wins', key: 'road', q: 'Road wins', opts: [['Same as home', 0], ['A bit more', 0.25], ['A lot more', 0.5]] },
  { sec: 'Wins', key: 'fcs', q: 'Wins over FCS teams', opts: [['Count fully', 1], ['Count half', 0.5], ['Don’t count', 0]] },
  { sec: 'Losses', key: 'lossBad', q: 'Losses to teams with losing records (or FCS)', opts: [['Like any loss', 0], ['Hurt more', 0.75], ['Hurt a lot', 1.5]] },
  { sec: 'Losses', key: 'goodLoss', q: 'Losses to ranked teams', opts: [['Hurt like any loss', 1], ['Hurt less', 0.6], ['Barely hurt', 0.25]] },
  { sec: 'Schedule', key: 'sos', q: 'Credit for a tough schedule, win or lose', opts: [['None', 0], ['Some', 0.5], ['A lot', 1]] },
  { sec: 'Full strength', key: 'qb', q: 'A win when the opponent’s starting QB didn’t play', opts: [['Counts the same', 1], ['Counts a bit less', 0.8], ['Counts much less', 0.5]] },
  { sec: 'Full strength', key: 'ownQb', q: 'A loss when your own starting QB didn’t play', opts: [['Hurts the same', 1], ['Hurts less', 0.6], ['Barely hurts', 0.25]] },
  { sec: 'Margin', key: 'margin', q: 'Margin of victory (or defeat)', opts: [['Only W/L matters', 0], ['Matters some', 0.5], ['Matters a lot', 1]] },
];
const DEFAULT = QUESTIONS.map(() => 1);
const PLAYOFF = 12;

function parseAnswers(s) {
  if (!s || s.length !== QUESTIONS.length) return [...DEFAULT];
  const a = [...s].map(Number);
  return a.every((x, i) => Number.isInteger(x) && x >= 0 && x < QUESTIONS[i].opts.length) ? a : DEFAULT;
}

/** Value of one game for the team's resume under the chosen answers. */
function gameValue(g, w, team, oppById) {
  const [oppId, , result, margin, site, apThen, oppQbOut, ownQbOut] = g;
  const opp = oppById.get(oppId); // undefined for FCS
  const fcs = !opp;
  const rankedNow = opp?.ap != null;
  const rankedThen = apThen != null;
  const rankedFactor = w.faded === 'then' ? (rankedThen || rankedNow ? 1 : 0) : w.faded === 'half' ? (rankedNow ? 1 : rankedThen ? 0.5 : 0) : rankedNow ? 1 : 0;
  const m = Math.min(Math.abs(margin), 21) / 21;
  // schedule credit for every game: from -1 (winless or FCS opponent) to +1 (unbeaten opponent)
  const sched = w.sos * (fcs ? -1 : (opp.pct - 0.5) * 2);
  if (result === 'W') {
    if (fcs) return w.fcs + sched;
    let v = 1 + (opp.pct > 0.5 ? w.winGood : 0) + w.ranked * rankedFactor + (site === 'A' ? w.road : 0) + w.margin * m;
    if (opp.tal != null && team.tal != null && opp.tal < team.tal) v += w.talentUp;
    if (oppQbOut) v *= w.qb;
    return v + sched;
  }
  let p = 1 + (fcs || opp.pct < 0.5 ? w.lossBad : 0) + w.margin * m;
  if (rankedFactor > 0) p *= w.goodLoss;
  if (ownQbOut) p *= w.ownQb;
  return -p + sched;
}

export default function Resume() {
  const { data, error } = useCfb('resume');
  const [params, setParams] = useSearchParams();
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  // answers live in state (so quick clicks never drop one) and are mirrored to ?r= for sharing
  const [answers, setAnswers] = useState(() => parseAnswers(params.get('r')));
  useEffect(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('r', answers.join(''));
      return next;
    }, { replace: true });
  }, [answers, setParams]);

  const ranked = useMemo(() => {
    if (!data) return [];
    const d = data.resume;
    const oppById = new Map(d.teams.map((t) => [t.id, t]));
    const w = Object.fromEntries(QUESTIONS.map((q, i) => [q.key, (q.opts[answers[i]] ?? q.opts[DEFAULT[i]])[1]]));
    const rows = d.teams.map((t) => {
      const vals = t.games.map((g) => ({ g, v: gameValue(g, w, t, oppById) }));
      const wins = vals.filter((x) => x.g[2] === 'W').sort((a, b) => b.v - a.v);
      const losses = vals.filter((x) => x.g[2] === 'L').sort((a, b) => a.v - b.v);
      return { ...t, score: vals.reduce((s, x) => s + x.v, 0), best: wins[0]?.g[1], worst: losses[0]?.g[1] };
    });
    rows.sort((a, b) => b.score - a.score || (a.ap ?? 99) - (b.ap ?? 99) || b.pct - a.pct);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }, [data, answers.join('')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Status error={error} />;
  const d = data.resume;

  const choose = (qi, oi) => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)));
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable; the address bar has the link */ }
  };
  const shown = showAll ? ranked : ranked.slice(0, 25);

  return (
    <>
      <h2>Resume Builder</h2>
      <p className="note">Answer the questions; your rankings update as you go. Games through {fmtDate(d.games_through)}.</p>
      <div className="resume">
        <div className="resume-q">
          {QUESTIONS.map((q, qi) => (
            <div key={q.key} className="q">
              {(qi === 0 || QUESTIONS[qi - 1].sec !== q.sec) && <div className="q-sec">{q.sec}</div>}
              <div className="q-text">{qi + 1}. {q.q}</div>
              <div className="q-opts">
                {q.opts.map(([label], oi) => (
                  <button key={label} type="button" className={answers[qi] === oi ? 'on' : undefined} onClick={() => choose(qi, oi)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="links">
            <button type="button" className="linkbtn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link to my rankings'}</button>
            {' | '}
            <button type="button" className="linkbtn" onClick={() => setAnswers([...DEFAULT])}>Reset</button>
          </p>
        </div>

        <div className="resume-r">
          <div className="cfb-scroll">
            <table className="cfb-t">
              <thead>
                <tr>
                  <th className="st" style={{ left: 0 }}>Rk</th>
                  <th className="l st" style={{ left: '2.6em' }}>Team</th>
                  <th>W-L</th>
                  <th title="Sum of game values under your answers">Score</th>
                  <th title={`AP poll of ${fmtDate(d.ap_released)}`}>AP</th>
                  <th title={`CFP ranking of ${fmtDate(d.cfp_released)}`}>CFP</th>
                  <th className="l">Best win</th>
                  <th className="l">Worst loss</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={r.rank <= PLAYOFF ? 'inrow' : undefined}>
                    <td className="st" style={{ left: 0 }}>{r.rank}</td>
                    <td className="l st" style={{ left: '2.6em' }}><Link to={`/cfb/team/${r.id}`}>{r.team}</Link></td>
                    <td>{rec(r.w, r.l)}</td>
                    <td>{r.score.toFixed(1)}</td>
                    <td>{r.ap ?? ''}</td>
                    <td>{r.cfp ?? ''}</td>
                    <td className="l">{r.best ?? ''}</td>
                    <td className="l">{r.worst ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Shaded = your top {PLAYOFF}.{' '}
            <button type="button" className="linkbtn" onClick={() => setShowAll((x) => !x)}>{showAll ? 'Show top 25' : `Show all ${ranked.length}`}</button>
          </p>
        </div>
      </div>
    </>
  );
}
