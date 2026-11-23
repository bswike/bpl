import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmtDate, rec, useCfb } from './data';
import { DEFAULT, PLAYOFF, QUESTIONS, SCALE, answersToParam, migrateOldAnswers, parseAnswers, rankTeams } from './resumeModel';
import Compare from './Compare';
import { CONF_GROUPS, makeFast, searchAgenda } from './resumeFast';
import { Status } from './ui';

export default function Resume() {
  const { data, error } = useCfb('resume', 'teams', 'resume_agendas');
  const [goals, setGoals] = useState({ love: '', hate: '', loveConf: '', hateConf: '' }); // agenda dropdowns
  const [agenda, setAgenda] = useState(null); // { s, parts, working } for the agenda last applied
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

  // ---- agendas: four dropdowns that can be combined. One goal uses its precomputed answers
  // (scripts/cfb-agendas.mjs); several are searched live, starting from each goal's precomputed answers.
  const ag = data.resume_agendas;
  const nameOf = new Map(d.teams.map((t) => [t.id, t.team]));
  const byName = (x, y) => nameOf.get(Number(x)).localeCompare(nameOf.get(Number(y)));
  const describe = (g, r) => [
    g.love && `${nameOf.get(Number(g.love))} #${r.love}`,
    g.hate && `${nameOf.get(Number(g.hate))} #${r.hate}`,
    g.loveConf && `${g.loveConf}: ${r.loveConf.top12} of ${r.loveConf.teams} in the top ${PLAYOFF}`,
    g.hateConf && `${g.hateConf}: ${r.hateConf.top12 ? `only ${r.hateConf.top12} of ${r.hateConf.teams}` : 'none'} in the top ${PLAYOFF}`,
  ].filter(Boolean);
  const precomputed = (g) => [
    g.love && ag.team[g.love], g.hate && ag.hate[g.hate], g.loveConf && ag.conf[g.loveConf], g.hateConf && ag.hateConf[g.hateConf],
  ].filter(Boolean);
  const runAgenda = (g) => {
    setGoals(g);
    const chosen = precomputed(g);
    if (!chosen.length) { setAgenda(null); return; }
    if (chosen.length === 1) {
      const e = chosen[0];
      const r = { love: e.rank, hate: e.rank, loveConf: e, hateConf: e };
      setAnswers(parseAnswers(e.s));
      setAgenda({ s: e.s, parts: describe(g, r) });
      return;
    }
    setAgenda({ working: true, parts: [] });
    setTimeout(() => { // let "Working…" paint first; the search takes a fraction of a second
      const F = makeFast(d.teams);
      const { answers: best, result } = searchAgenda(F, {
        love: g.love ? Number(g.love) : null, hate: g.hate ? Number(g.hate) : null,
        loveConf: g.loveConf ? CONF_GROUPS[g.loveConf] : null, hateConf: g.hateConf ? CONF_GROUPS[g.hateConf] : null,
      }, { starts: 20, kicks: 40, seeds: chosen.map((e) => parseAnswers(e.s)) });
      setAnswers(best);
      setAgenda({ s: answersToParam(best), parts: describe(g, result) });
    }, 20);
  };
  const pickGoal = (key, value) => runAgenda({ ...goals, [key]: value });
  const agendaEdited = agenda && !agenda.working && answersToParam(answers) !== agenda.s;
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
            <div className="agenda-grid">
              <label>Team you want to look good
                <select value={goals.love} onChange={(e) => pickGoal('love', e.target.value)}>
                  <option value="">—</option>
                  {Object.keys(ag.team).sort(byName).map((id) => <option key={id} value={id}>{nameOf.get(Number(id))}</option>)}
                </select>
              </label>
              <label>Team you hate
                <select value={goals.hate} onChange={(e) => pickGoal('hate', e.target.value)}>
                  <option value="">—</option>
                  {Object.keys(ag.hate).sort(byName).map((id) => <option key={id} value={id}>{nameOf.get(Number(id))}</option>)}
                </select>
              </label>
              <label>Conference you’re pushing
                <select value={goals.loveConf} onChange={(e) => pickGoal('loveConf', e.target.value)}>
                  <option value="">—</option>
                  {Object.keys(ag.conf).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Conference you hate
                <select value={goals.hateConf} onChange={(e) => pickGoal('hateConf', e.target.value)}>
                  <option value="">—</option>
                  {Object.keys(ag.hateConf).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            {agenda && (
              <div className="note">
                {agenda.working ? 'Working…' : `Answers set for your agenda: ${agenda.parts.join(' · ')}.`}
                {agendaEdited ? ' You’ve changed answers since.' : ''}
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
            <button type="button" className="linkbtn" onClick={() => { setAnswers([...DEFAULT]); setAgenda(null); setGoals({ love: '', hate: '', loveConf: '', hateConf: '' }); }}>Reset</button>
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
