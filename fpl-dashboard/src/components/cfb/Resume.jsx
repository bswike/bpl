import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmtDate, rec, useCfb } from './data';
import { DEFAULT, PLAYOFF, QUESTIONS, SCALE, answersToParam, migrateOldAnswers, parseAnswers, rankTeams } from './resumeModel';
import Compare from './Compare';
import { Status } from './ui';

export default function Resume() {
  const { data, error } = useCfb('resume', 'teams', 'resume_agendas');
  const [agenda, setAgenda] = useState(null); // {label, s, result} of the last agenda applied
  const [params, setParams] = useSearchParams();
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  // answers live in state (so quick clicks never drop one) and are mirrored to ?s= for sharing;
  // an older three-option link (?r=) is converted once
  const [answers, setAnswers] = useState(() =>
    params.get('s') ? parseAnswers(params.get('s')) : migrateOldAnswers(params.get('r')) ?? [...DEFAULT]);
  useEffect(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('r');
      next.set('s', answersToParam(answers));
      return next;
    }, { replace: true });
  }, [answers, setParams]);

  const ranked = useMemo(() => {
    if (!data) return [];
    return rankTeams(data.resume.teams, answers);
  }, [data, answers.join('')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Status error={error} />;
  const d = data.resume;
  const teamsById = new Map(data.teams.map((t) => [t.team_id, t]));
  const fpiAsOf = d.fpi_as_of ? fmtDate(d.fpi_as_of) : null;

  const choose = (qi, oi) => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)));

  // ---- agendas: answers precomputed (scripts/cfb-agendas.mjs) to best serve one goal
  const ag = data.resume_agendas;
  const nameOf = new Map(d.teams.map((t) => [t.id, t.team]));
  const byName = (a, b) => nameOf.get(Number(a)).localeCompare(nameOf.get(Number(b)));
  const applyAgenda = (value) => {
    if (!value) { setAgenda(null); return; }
    const [kind, key] = value.split(':');
    const entry = ag[kind]?.[key];
    if (!entry) return;
    const label = kind === 'team' ? `Make ${nameOf.get(Number(key))} look good`
      : kind === 'hate' ? `Hate ${nameOf.get(Number(key))}` : `${key} agenda`;
    const result = kind === 'team' ? `best possible rank, #${entry.rank}`
      : kind === 'hate' ? `worst possible rank, #${entry.rank}` : `${entry.top12} of ${entry.teams} ${key} teams in the top ${PLAYOFF}`;
    setAnswers(parseAnswers(entry.s));
    setAgenda({ value, label, s: entry.s, result });
  };
  const agendaEdited = agenda && answersToParam(answers) !== agenda.s;
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
          <div className="q agenda">
            <div className="q-text">Do you have an agenda?</div>
            <select value={agenda?.value ?? ''} onChange={(e) => applyAgenda(e.target.value)} aria-label="Pick an agenda">
              <option value="">No agenda</option>
              <optgroup label="Make a team look good">
                {Object.keys(ag.team).sort(byName).map((id) => <option key={id} value={`team:${id}`}>{nameOf.get(Number(id))}</option>)}
              </optgroup>
              <optgroup label="Conference agenda">
                {Object.keys(ag.conf).map((c) => <option key={c} value={`conf:${c}`}>{c} agenda</option>)}
              </optgroup>
              <optgroup label="Hate a team">
                {Object.keys(ag.hate).sort(byName).map((id) => <option key={id} value={`hate:${id}`}>Hate {nameOf.get(Number(id))}</option>)}
              </optgroup>
            </select>
            {agenda && (
              <div className="note">
                {agenda.label} → {agenda.result}.{agendaEdited ? ' You’ve changed answers since.' : ''}
              </div>
            )}
          </div>
          {QUESTIONS.map((q, qi) => (
            <div key={q.key} className="q">
              {(qi === 0 || QUESTIONS[qi - 1].sec !== q.sec) && <div className="q-sec">{q.sec}</div>}
              <div className="q-text">{qi + 1}. {q.q}</div>
              <div className="q-scale">
                <span className="q-lo">{q.lo}</span>
                {Array.from({ length: SCALE }, (_, oi) => (
                  <button key={oi} type="button" className={answers[qi] === oi ? 'on' : undefined} onClick={() => choose(qi, oi)} aria-label={`${oi + 1} of ${SCALE}`}>
                    {oi + 1}
                  </button>
                ))}
                <span className="q-hi">{q.hi}</span>
              </div>
            </div>
          ))}
          <p className="links">
            <button type="button" className="linkbtn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link to my rankings'}</button>
            {' | '}
            <button type="button" className="linkbtn" onClick={() => { setAnswers([...DEFAULT]); setAgenda(null); }}>Reset</button>
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
                  <th title={`ESPN Football Power Index${fpiAsOf ? `, as of ${fpiAsOf}` : ''}`}>FPI</th>
                  <th title={`ESPN strength of record rank${fpiAsOf ? `, as of ${fpiAsOf}` : ''}`}>SOR</th>
                  <th title={`ESPN strength of schedule rank (games played)${fpiAsOf ? `, as of ${fpiAsOf}` : ''}`}>SOS</th>
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
                    <td>{r.fpi == null ? '' : r.fpi.toFixed(1)}{r.fpi_rank != null && <span className="rk">{r.fpi_rank}</span>}</td>
                    <td>{r.sor ?? ''}</td>
                    <td>{r.sos ?? ''}</td>
                    <td className="l">{r.best ?? ''}</td>
                    <td className="l">{r.worst ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Shaded = your top {PLAYOFF}. FPI, SOR, SOS: ESPN{fpiAsOf ? `, as of ${fpiAsOf}` : ''}.{' '}
            <button type="button" className="linkbtn" onClick={() => setShowAll((x) => !x)}>{showAll ? 'Show top 25' : `Show all ${ranked.length}`}</button>
          </p>
        </div>
      </div>
      <Compare ranked={ranked} teamsById={teamsById} fpiAsOf={fpiAsOf} />
    </>
  );
}
