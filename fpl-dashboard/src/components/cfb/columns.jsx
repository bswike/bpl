import { fmtDate, num, pct, rec, recKey, signed } from './data';
import { T50, TeamLink } from './ui';

// Column definitions shared by the table pages. `basis` lookups come from teams.json (top50_basis).

export const colT50 = (basisOf) => ({
  key: 't50',
  label: 'Rk',
  title: 'Top-50 rank: AP Top 25, then teams receiving AP votes, then projected (p)',
  value: (r) => r.top50_rank ?? null,
  render: (r) => <T50 rank={r.top50_rank} basis={basisOf(r)} />,
  sticky: '0',
});

export const colTeam = {
  key: 'team',
  label: 'Team',
  left: true,
  sticky: '2.6em',
  value: (r) => r.team,
  render: (r) => <TeamLink id={r.team_id}>{r.team}</TeamLink>,
};

export const colConf = (confOf = (r) => r.conference) => ({ key: 'conf', label: 'Conf', left: true, value: confOf });

export const colRecord = (key, label, w, l, extra = {}) => ({
  key,
  label,
  desc: true,
  value: (r) => recKey(r[w], r[l]),
  render: (r) => rec(r[w], r[l]),
  ...extra,
});

/** Record against opponents ranked in the latest poll (meta.latest_poll: AP or CFP, whichever came out last). */
export const colCurRanked = (latest) => colRecord('cur', 'Vs. Currently\nRanked', 'vs_cur_ranked_w', 'vs_cur_ranked_l', {
  title: latest
    ? `Record against opponents ranked in the ${latest.poll === 'CFP' ? 'CFP ranking' : 'AP poll'} of ${fmtDate(latest.released)}, the most recent poll, whenever the game was played`
    : 'Record against opponents ranked in the most recent poll',
});

/** Records against opponents AP-ranked at least once, ranked in the latest poll, and by talent tier. */
export const splitCols = (latest) => [
  colCurRanked(latest),
  colRecord('apY', 'Yes', 'vs_ap_ranked_w', 'vs_ap_ranked_l', {
    group: 'Opp. AP-ranked at least\nonce this season',
    title: 'Record against opponents that appeared in at least one 2026 AP Top 25 (preseason on), whenever the game was played',
  }),
  colRecord('apN', 'No', 'vs_ap_unranked_w', 'vs_ap_unranked_l', {
    group: 'Opp. AP-ranked at least\nonce this season',
    title: 'Record against opponents never in a 2026 AP Top 25, FCS included',
  }),
  colRecord('t1', '1-25', 'vs_talent_t1_w', 'vs_talent_t1_l', { group: 'vs. opp. 247 talent rank', title: 'Opponent ranked 1-25 in the 247Sports Team Talent Composite' }),
  colRecord('t2', '26-50', 'vs_talent_t2_w', 'vs_talent_t2_l', { group: 'vs. opp. 247 talent rank', title: 'Opponent ranked 26-50' }),
  colRecord('t3', '51+', 'vs_talent_t3_w', 'vs_talent_t3_l', { group: 'vs. opp. 247 talent rank', title: 'Opponent ranked 51 or lower, or FCS' }),
];

const g = 'Game control';
export const colLead = { key: 'lead', label: 'Lead%', group: g, desc: true, rank: true, title: 'Share of regulation time leading', value: (r) => r.lead_pct, render: (r) => pct(r.lead_pct) };
export const colTied = { key: 'tied', label: 'Tied%', group: g, desc: true, title: 'Share of regulation time tied', value: (r) => r.tied_pct, render: (r) => pct(r.tied_pct) };
export const colTrail = { key: 'trail', label: 'Trail%', group: g, rank: true, title: 'Share of regulation time trailing', value: (r) => r.trail_pct, render: (r) => pct(r.trail_pct) };
export const colAvgLead = { key: 'avgl', label: 'AvgLead', group: g, desc: true, rank: true, title: 'Scoring margin averaged over every second of regulation, per game', value: (r) => r.avg_lead, render: (r) => signed(r.avg_lead) };
export const colNg = {
  key: 'ng',
  label: 'NG Marg',
  group: g,
  desc: true,
  rank: true,
  title: 'Margin per game with garbage time removed (lead of 38+ in Q2, 28+ in Q3, 22+ in Q4). Overtime counts.',
  value: (r) => r.ng_margin_pg,
  render: (r) => signed(r.ng_margin_pg),
};

export const colRankNum = (key, label, field, title, extra = {}) => ({ key, label, title, value: (r) => r[field] ?? null, render: (r) => num(r[field]), ...extra });
