# CFB 2026 team metrics

Data, pipeline and notes from a Claude chat on 2026-11-22, packaged so a website can be built from them.

- **Start with** `CLAUDE.md` (project brief) and `docs/conversation-summary.md`.
- **Data** is in `data/json` and `data/csv`; columns are described in `docs/data-dictionary.md`.
- **Rebuild** with `python pipeline/build.py`; refresh the feeds first with `bash pipeline/fetch_raw.sh`.
- **Methods and checks** are in `docs/methodology.md`.

Snapshot: games through 2026-11-21, AP poll of 2026-11-22, CFP ranking of 2026-11-17,
247Sports Team Talent Composite as of 2026-08-28.

Sources: ESPN game, poll and play-by-play data via the sportsdataverse `cfbfastR-cfb-raw` and
`cfbfastR-cfb-data` repositories; 247Sports for the talent composite; published AP results for teams
receiving votes.
