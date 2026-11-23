# Methodology and checks

How each number is defined, where the data comes from, what was verified, and where the weak spots are.

## Sources

| Data | Source | Notes |
|---|---|---|
| Game results, quarter scores, sites, team names, colors, logos | ESPN, via `sportsdataverse/cfbfastR-cfb-raw` (`cfb/schedules/csv`) | 822 completed regular-season games involving FBS teams, FBS-vs-FCS games included. |
| Standings | ESPN, same repository (`cfb/standings/json/fbs`) | Used to define the 138 FBS teams and to check overall records. |
| AP and CFP polls | ESPN, via `sportsdataverse/cfbfastR-cfb-data` (`cfb/poll_analytics/parquet`) | AP weeks 2-13 and CFP weeks 10-12. |
| Play-by-play | ESPN, same repository (`cfb/pbp/parquet`) | 142,832 plays covering all 822 games. |
| Talent composite | 247sports.com, 2026 College Football Team Talent Composite | Read from the site on 2026-11-22; page says last updated 2026-08-28. Hand-entered in `data/manual/`. |
| AP "others receiving votes" | Published AP results for the Nov 22 poll | Not in any feed. Hand-entered in `data/manual/`. |

## AP poll and "ranked at least once"

- The poll feed starts with the first in-season poll (week 2). The **preseason poll** is recovered from the
  rank shown beside each team in week-1 games. All 25 preseason teams played in week 1, so the list is
  complete. The feed showed BYU and USC both at 14; the published order was BYU 14, USC 15, and that fix is
  in `data/manual/published.json`.
- Game-time ranks are only usable for this in weeks 1-9. **From week 10 the game feed shows CFP ranks, not
  AP ranks.** For weeks 2-9 the game-time ranks matched the poll feed exactly, team for team.
- A team is "AP ranked" for the whole season if it appears in any of the 13 polls. 41 teams qualify. Teams
  that only appeared once: Pittsburgh (week 6), Wisconsin (week 9), Memphis (week 12).
- Checked against published polls during the chat: preseason, Sept 8, Sept 13, Oct 18, Oct 25, Nov 1,
  Nov 16 and Nov 22 in full or in the parts quoted by news reports; Nov 8 in part.

## Records

- A game counts for both teams. Winner by final score; there are no ties.
- Overall records for all 138 FBS teams equal ESPN's standings feed. The build fails if they ever differ.
- During the chat, the 76 power-set records were also checked against Sportradar standings, and the game
  logs for Notre Dame and Oklahoma were checked game by game against Sportradar.
- Dates are converted to US Eastern time, so a late Saturday kickoff stays on Saturday.

## Talent tiers

- The 247Sports **Composite** version is used, not 247's own new Team Talent Rating, which orders teams
  differently (for example Oregon second instead of Texas).
- All 138 listed teams map one to one onto the 138 FBS teams in the standings feed.
- The top 50 was read from 247's page and cross-checked against a second listing made at release. The two
  agree on the membership of both tiers. Louisville was 37th at release and is 41st on the current page,
  which does not change its tier.
- The cut is tight at the top-25 line: UCLA is 25th (774.45 points) and Penn State 26th (774.04).
- It is a preseason snapshot of how players were rated as recruits. It does not move during the season.

## Top 50 and the model

- Ranks 1-25: AP Top 25 of Nov 22. Ranks 26-37: the 12 other teams that received AP votes, by points.
  Ranks 38-50: every remaining FBS team ordered by the model.
- **Model:** `0.7 x z(Colley) + 0.3 x z(SRS)`.
  - Colley: wins and losses only, adjusted for opponent strength.
  - SRS: per-game margin capped at 24 points, adjusted for opponent strength, with a fitted home edge
    (about 2.5 points). All FCS opponents are pooled as one team.
- **Calibration:** run on the games the committee had seen (through Nov 15), the model's own top 25 contains
  24 of the committee's 25. It leaves out South Carolina and includes LSU instead. Weights from 0.6 to 0.8
  on Colley gave nearly the same lists; 0.7 was chosen because it kept that 24-of-25 fit and also placed
  all 13 AP-voted teams outside the committee's list inside ranks 26-50.
- **Weak spot:** the model rewards scoring margin and schedule more than voters do. LSU (6-5, nine games
  against top-25 rosters) is its most debatable call: 23rd in the model, with no AP votes on Nov 22.
- The model was tuned on one week's committee ranking. Treat `model_rank` as a rough guide.

## Projected spreads (upcoming games)

- Projected margin = SRS(team) - SRS(opponent) + the fitted home edge (about 2.5 points), or no edge at a neutral
  site. Shown as a spread rounded to the half point, negative = favored. FCS opponents use the pooled FCS rating.
- SRS caps each game's margin at 24 points when it is fitted, so projections for mismatches run smaller than a
  betting line would. These are the model's estimates, not lines, and are not checked against results yet.
- Games whose opponent is not yet known (most conference championships and all bowls) are listed without a spread.

## Game control

- **Time shares:** for each game the score is tracked across the 3,600 seconds of regulation. `lead_pct`,
  `tied_pct` and `trail_pct` are a team's share of that time over all its games.
- **Average lead:** scoring margin averaged over every second of regulation, then averaged over games.
- **Garbage-time-free margin:** points count only if scored when the game was not in garbage time, defined
  as a lead of 38+ in the second quarter, 28+ in the third or 22+ in the fourth. Overtime points count.
- **Never trailed, comebacks, blown leads:** from the largest lead and largest deficit in each game,
  including the final score. Comebacks and blown leads use a 10-point threshold.
- Overtime has no clock, so it changes margins but not time shares.

### Rebuilding the score timeline

ESPN play feeds are not clean. In this file, 147 games had plays out of order, 42 had a score that went
down, and in 9 the last play's score was not the final score. So the timeline is rebuilt per quarter and
anchored to the official quarter-by-quarter scores (which do add up to every final score):

1. Sort plays by game clock within the quarter.
2. Clip each play's posted score to the official range for that quarter.
3. Fit a non-decreasing sequence that minimises absolute error, which discards stray values.
4. Credit any points the plays never showed at the end of the quarter.

- The repair changed time-leading by more than 30 seconds in 16 of 822 games; the other 806 were already
  consistent.
- In 17 games a total of 82 points could not be timed within their quarter and sit at the quarter's end.
- Spot checks against game reports: Texas led Ohio State for 25 seconds and trailed by 20 before winning
  24-23; Notre Dame never trailed Miami; Rutgers beat Penn State without leading until the end.
- The play-by-play file also carries win probability per play. It was not used, because it is computed from
  the same unreliable play ordering and score fields.

## Home, away and neutral

- Site comes from the feed's neutral-site flag. Ten games are neutral: North Carolina-TCU, Auburn-Baylor,
  Louisville-Ole Miss, Notre Dame-Wisconsin, Arizona State-Kansas, Virginia-West Virginia, Oklahoma-Texas,
  Florida-Georgia, Navy-Notre Dame and Central Michigan-Eastern Michigan.
- The build checks that each team's home, away and neutral rows add up to its season totals in every
  category.

## Rounding

Shares are stored to four decimals and point values to two. Ranks are computed before rounding. A value
that sits exactly on a rounding boundary can differ by one unit in the last place from the Excel workbook
(one such case was found: Nevada's home average lead, 0.99 against 1.00).

## Timing caveats

- The CFP ranking (Nov 17) is older than the records and the AP poll (through Nov 21 and Nov 22). UCLA, for
  example, was 10-0 when the committee ranked it fourth and is 10-1 in the data.
- The next CFP ranking is due Nov 24. A new AP poll follows each weekend.

## Past seasons (2020-2025)

Built by `pipeline/history.py` for the team pages, with the 2026 definitions and these changes:

- **Games:** regular season and postseason (bowls, playoff). All-star and exhibition games are left out. FBS teams
  are the teams ESPN flags as FBS that belong to an FBS conference that season (this drops all-star squads that the
  flag also catches); for 2024 that set matches ESPN's standings exactly.
- **Missing games:** the raw 2022 schedule has no week 3 or week 12 games (137 games). They are filled from
  `cfb_schedules` (same ESPN game ids) with quarter scores from `linescores`; all 137 have quarter scores that add up.
  Where both sources have a game they agree on every score but one.
- **Checks:** every FBS team's record in every season equals the record computed from `cfb_schedules`; 2024 records
  equal ESPN's standings feed for all 134 teams. Spot checks: Alabama 2020 13-0, Georgia 2022 15-0, Michigan 2023
  15-0, Ohio State 2024 14-2, Indiana 2025 16-0.
- **AP:** "ranked at least once" spans the preseason poll through the final post-bowl poll. The 2025 feed lacks the
  preseason poll; it is recovered from week-1 game ranks, as for 2026.
- **Talent:** 247Sports Team Talent Composite, read from 247's page for each season on 2026-11-22 and re-ranked among
  that season's FBS teams (2020-2023 pages include FCS schools). The pages' "last updated" dates vary (2020: Nov 9,
  2021: Oct 4, 2022: Dec 4, 2023: Sep 18, 2024: Aug 27, 2025: Aug 27). Teams 247 does not list (Air Force, Army and
  Navy in some years) have no rank and count as 51+.
- **Game control:** same method. Games without play-by-play (at most about 4% of team-games, 2021) are left out of
  the time shares; `control_games` says how many games a team's numbers use. One 2024 game with quarter scores that
  do not add up is skipped.
