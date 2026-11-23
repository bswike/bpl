import { fmtDate, useCfb } from './data';
import { Status } from './ui';

export default function About() {
  const { data, error } = useCfb('meta');
  if (!data) return <Status error={error} />;
  const m = data.meta;
  const cal = m.model.calibration_vs_cfp_committee;
  return (
    <div className="prose">
      <h2>About these numbers</h2>

      <h3>As of</h3>
      <ul>
        <li>Games: {m.completed_games} completed regular-season games through {fmtDate(m.games_through, true)}, {m.fbs_teams} FBS teams.</li>
        <li>AP poll: released {fmtDate(m.ap_poll.released, true)} ({m.ap_poll.polls_this_season} polls this season, preseason included).</li>
        <li>CFP committee ranking: released {fmtDate(m.cfp.released, true)}. It was made before any later games. Next release {fmtDate(m.cfp.next_release, true)}.</li>
        <li>247Sports Team Talent Composite: last updated {fmtDate(m.talent.last_updated, true)}. It ranks roster talent before the season and does not change during it.</li>
      </ul>

      <h3>Definitions</h3>
      <dl>
        <dt>Opponent AP-ranked at least once this season</dt>
        <dd>
          The opponent appeared in any 2026 AP Top 25, from the preseason poll through the latest one ({m.ap_poll.teams_ranked_this_season} teams). It counts
          for every game against that team, whatever its rank on game day. This is not “ranked at kickoff”. FCS opponents count as never ranked.
        </dd>
        <dt>Talent tiers</dt>
        <dd>The opponent’s rank in the 247Sports Composite: 1-25, 26-50, 51+. FCS opponents are in 51+.</dd>
        <dt>Rk (top 50)</dt>
        <dd>
          1-25 are the latest AP Top 25. The next spots go to the other teams receiving AP votes, by points. The remaining spots are filled by this site’s
          model and marked <span className="proj">p</span>. Those are an estimate, not a published ranking.
        </dd>
        <dt>Model*</dt>
        <dd>
          {m.model.blend.colley} × Colley rating (schedule-adjusted wins and losses) + {m.model.blend.srs} × a simple rating system on scoring margin capped at{' '}
          {m.model.margin_cap} points (opponent-adjusted, with a fitted home edge of about {m.model.fitted_home_edge_points.toFixed(1)} points), both as z-scores.
          On the games the committee had seen for its week {cal.committee_week} ranking, the model’s top 25 included {cal.committee_teams_in_model_top25} of the
          committee’s 25. Treat it as a rough guide. It rewards margin and schedule more than voters do.
        </dd>
        <dt>Game control</dt>
        <dd>
          Lead% / Tied% / Trail%: share of the 3,600 seconds of regulation spent ahead, level or behind, across all games. AvgLead: scoring margin averaged
          over every second of regulation. NG Marg: margin counting only points scored outside garbage time (lead of 38+ in Q2, 28+ in Q3, 22+ in Q4).
          Overtime counts toward margins but not time shares.
        </dd>
        <dt>Comebacks and blown leads</dt>
        <dd>Wins after trailing by 10 or more, and losses after leading by 10 or more.</dd>
        <dt>Home / away / neutral</dt>
        <dd>Neutral-site games are their own split, so a team’s three rows add up to its season.</dd>
      </dl>

      <h3>Past seasons (team pages)</h3>
      <p>
        Each team page has a season row and a season-by-season table for 2020-2025, built with the same definitions,
        with three differences that suit a finished season:
      </p>
      <ul>
        <li>Bowl and playoff games count. Records are full-season records, and the postseason record is shown separately.</li>
        <li>“AP-ranked at least once” covers every AP poll of that season, preseason through the final post-bowl poll.</li>
        <li>AP Final and CFP are the final AP poll and the final committee ranking. Talent is the 247Sports composite rank among that season’s FBS teams. 247 does not list some service academies in some years; they count as 51+.</li>
      </ul>
      <p>
        ESPN’s 2022 schedule feed is missing weeks 3 and 12; those games come from a second ESPN-derived schedule in the
        same data repositories. Every past record was checked against that second source, and the 2024 records against
        ESPN’s standings. A few games (at most about 4% in a season) have no play-by-play, so game-control numbers for
        those seasons use the games that do.
      </p>

      <h3>How the score timeline was rebuilt</h3>
      <p>
        ESPN play feeds have plays out of order and scores that go backwards. Each game’s timeline is rebuilt quarter by quarter and anchored to the official
        quarter scores. In {m.game_control.games_with_untimed_points} games, {m.game_control.untimed_points} points could not be timed within their quarter
        and are placed at the quarter’s end.
      </p>

      <h3>Sources</h3>
      <ul>
        <li>Game results, play-by-play, AP and CFP polls: ESPN, via the sportsdataverse cfbfastR data repositories.</li>
        <li>
          Talent: <a href={m.talent.url} rel="noreferrer" target="_blank">{m.talent.name}</a>.
        </li>
        <li>AP “others receiving votes”: hand-entered from published AP results.</li>
      </ul>
      <p className="muted">Built {m.built_at_utc.replace('T', ' ').replace('Z', ' UTC')}. Not affiliated with ESPN, the AP, the CFP or 247Sports.</p>
    </div>
  );
}
