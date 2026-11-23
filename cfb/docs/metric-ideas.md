# Metric ideas

Ideas proposed in the chat when the user asked about unconventional metrics. Game control and the
home/away splits were built. The rest were not.

## Possible with the data already here

| Idea | What it would show | Notes |
|---|---|---|
| Wins above talent | Expected wins from the roster-talent gap in each game, against actual wins | Utah (58th roster, 11-0) and Texas A&M (7th, 4-7) are the extremes. Needs a talent-to-win-probability curve. |
| Upset ledger | Record as the talent favorite and as the talent underdog | Straight from `games` using `opp_talent_rank` and the team's own rank. |
| Luck index | Record in one-score games, and actual wins against wins implied by scoring margin | `games` has margins. |
| How wins aged | What opponents did after you played them | Marks down early wins over teams that later collapsed. |
| Voters vs. results | AP rank minus model rank | Flags teams ranked on reputation or ignored despite results. LSU is 23rd in the model with no AP votes on Nov 22. |
| Schedule spots | Records after a bye, on short weeks, after long trips, or between two ranked opponents | Dates are in `games`; travel distance would need venue coordinates. |

## Need another data pull

The same data source carries betting lines and full play-by-play.

| Idea | What it would show | Notes |
|---|---|---|
| Market surprise | Record against the spread and points above the closing line | `cfb/betting/parquet/betting_2026.parquet` in `cfbfastR-cfb-data`. Not yet inspected. |
| Win-probability control | Average in-game win probability | The play-by-play file has win probability per play, but its play ordering and score fields are unreliable in some games (see methodology), so it was left out. |
| Turnover luck | Fumble-recovery rate and similar stats that tend to even out | Play-by-play has turnover fields. Not yet inspected. |
