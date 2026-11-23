import { Link } from 'react-router-dom';
import { fmtDate, num, pct, rec, recKey, signed, teamHref } from './data';
import { ConfCell, T50, TeamLink } from './ui';

// Column definitions shared by the table pages. `basis` lookups come from teams.json (top50_basis).

export const colT50 = (basisOf) => ({
  key: 't50',
  label: 'Rk',
  title: 'Rank: AP Top 25, then teams receiving AP votes, then projected by the model (p)',
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

export const colConf = (confOf = (r) => r.conference) => ({
  key: 'conf',
  label: 'Conf',
  left: true,
  title: 'Conference, with the conference record (regular season, title games not included)',
  value: confOf,
  render: (r) => <ConfCell conf={confOf(r)} w={r.conf_w} l={r.conf_l} />,
});

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
  colRecord('t3', '51-75', 'vs_talent_t3_w', 'vs_talent_t3_l', { group: 'vs. opp. 247 talent rank', title: 'Opponent ranked 51-75' }),
  colRecord('t4', '76+', 'vs_talent_t4_w', 'vs_talent_t4_l', { group: 'vs. opp. 247 talent rank', title: 'Opponent ranked 76 or lower, or FCS' }),
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

/** Every stat column of the ratings table after Rk and Team; also used for opponents on team pages. */
export const teamStatCols = (meta) => [
  colConf(),
  colRecord('wl', 'W-L', 'wins', 'losses'),
  colRankNum('ap', 'AP', 'ap_rank', `AP rank, poll of ${meta?.ap_poll.released}`, { group: 'Rankings' }),
  colRankNum('cfp', 'CFP', 'cfp_rank', `CFP committee rank of ${meta?.cfp.released} (before later games)`, { group: 'Rankings' }),
  colRankNum('tal', 'Talent', 'talent_rank', '247Sports 2026 Team Talent Composite rank (preseason roster talent)', { group: 'Rankings' }),
  colRankNum('model', 'Model*', 'model_rank', "This site's model rank among 138 FBS teams. An estimate, not an official ranking.", { group: 'Rankings' }),
  ...splitCols(meta?.latest_poll),
  colRecord('home', 'Home', 'home_w', 'home_l', { group: 'Site' }),
  colRecord('away', 'Away', 'away_w', 'away_l', { group: 'Site' }),
  colRecord('neut', 'Neut', 'neutral_w', 'neutral_l', { group: 'Site' }),
  colLead,
  colAvgLead,
  colNg,
];

/**
 * Columns for a past season's table (history team_seasons rows). AP = final (post-bowl) poll; CFP only from 2014 and
 * 247 talent only from 2015, when those exist. "Currently ranked" means ranked in that season's last poll.
 */
export const pastSeasonCols = (season) => {
  const talent = season >= 2015;
  const rankings = { group: 'Rankings' };
  return [
    { key: 'apf', label: 'AP', title: 'Final AP poll rank (after the bowls)', sticky: '0',
      value: (r) => r.ap_final_rank ?? 100 + (1 - r.wins / Math.max(r.wins + r.losses, 1)) * 50, render: (r) => num(r.ap_final_rank) },
    { ...colTeam, render: (r) => <Link to={teamHref(r.team_id, season)}>{r.team}</Link> },
    colConf(),
    colRecord('wl', 'W-L', 'wins', 'losses', { title: 'Full-season record, bowls and playoff included' }),
    colRecord('post', 'Post', 'post_w', 'post_l', { title: 'Bowl and playoff record' }),
    colRankNum('pre', 'AP Pre', 'ap_pre_rank', 'Preseason AP rank', rankings),
    ...(season >= 2014 ? [colRankNum('cfp', 'CFP', 'cfp_final_rank', 'Final CFP committee rank', rankings)] : []),
    ...(talent ? [colRankNum('tal', 'Talent', 'talent_rank', '247Sports Team Talent Composite rank among FBS teams that season', rankings)] : []),
    ...splitCols(null)
      .filter((c) => talent || !['t1', 't2', 't3', 't4'].includes(c.key))
      .map((c) => ({
        cur: { ...c, title: 'Record against opponents ranked in that season’s final AP poll' },
        apY: { ...c, title: 'Record against opponents that appeared in any AP Top 25 that season (preseason through final)' },
        apN: { ...c, title: 'Record against opponents never in an AP Top 25 that season, FCS included' },
      }[c.key] ?? c)),
    colRecord('home', 'Home', 'home_w', 'home_l', { group: 'Site' }),
    colRecord('away', 'Away', 'away_w', 'away_l', { group: 'Site' }),
    colRecord('neut', 'Neut', 'neutral_w', 'neutral_l', { group: 'Site' }),
    colLead,
    colAvgLead,
    colNg,
  ];
};
