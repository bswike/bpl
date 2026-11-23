# What happened in the chat

A record of the conversation this project came from (2026-11-22), in order: what the user asked for,
how each request was read, and what came out. Numbers are as of games through 2026-11-21.

## 1. Records against ranked and unranked teams

**Asked:** for every "Power 5 + Notre Dame" team, the record against teams that have been ranked at least
once this year and against teams that have not, using the AP poll from week 1 through now.

**How it was read:**
- Teams: ACC, Big 12, Big Ten, SEC and Notre Dame (68 teams). The eight-team 2026 Pac-12 was added and
  labelled because the user said "Power 5", for 76 in all. The user did not comment on either choice.
- "Ranked at least once": appeared in any AP Top 25 from the preseason poll (Aug 17) through the Nov 22
  poll. That is 13 polls and 41 teams. A team counts as ranked for every game against it, whenever it was
  played. FCS opponents count as unranked.

**Headline results:**
- Georgia 6-0 against ranked teams, 4-1 against unranked. Notre Dame 3-1 and 7-0.
- Unbeaten against ranked teams: Georgia (6-0), Utah (3-0), Texas Tech (3-0).
- Winless against ranked teams: Texas A&M and Purdue, both 0-7. Arizona 0-3 but 8-0 against unranked teams.
- Oklahoma played 10 of its 11 games against ranked teams (6-4).

## 2. Delivery problem

The first version went out as an online spreadsheet. The user was on a phone and it would not open ("this
browser is not supported"). From then on, results were given as tables in the chat plus an Excel file,
and the user asked for every later addition to go into the Excel file.

## 3. Talent tiers

**Asked:** use the 247Sports team composite rankings and redo the records as 1-25, 25-50, 50+.

**How it was read:** the 2026 247Sports Team Talent Composite, a preseason ranking of roster talent. 247
publishes two versions this year (the industry Composite and its own new Team Talent Rating); the
Composite version was used because that is what was asked for. Buckets are opponent rank 1-25, 26-50
and 51+, with FCS opponents in 51+.

**Headline results:**
- Georgia 6-1 against top-25 rosters, the best mark of any team with more than one such game.
- Ohio State 0-4 and Texas A&M 0-7 against top-25 rosters.
- No Big 12 roster is in the top 25 (Texas Tech is highest at 29th), so 11 Big 12 teams have no games in
  that tier. Utah is 11-0 with the 58th-ranked roster.

## 4. Rankings tab, three versions

1. **Asked:** a tab for the current CFP rankings with all stats next to each team. Built from the
   committee's Nov 17 Top 25, with a note that it predates the Nov 21 games.
2. **Asked:** instead of just 1-25, show the next 26-50 "you'd think would fit". A model was built for this
   (see methodology) and used to project ranks 26-50.
3. **Asked:** use the AP poll for 1-25, teams receiving votes for the next spots, and the projection once
   those run out. **This is the current definition of the top 50:** AP Top 25, then the 12 other teams with
   AP votes (ranks 26-37), then 13 projected teams (ranks 38-50). The committee's rank was kept as a
   column.

## 5. Unconventional metrics

The user asked to discuss other unconventional metrics. A list was proposed (`docs/metric-ideas.md`). The
user picked **game control**, and while it was being built also asked for **home and away splits for each
category**.

**Game control headline results** (share of regulation time leading, all 138 FBS teams):
- Notre Dame 80%, Georgia 78%, Utah 75%, Wake Forest 74%.
- Least time trailing: UCLA 7%, Georgia 8%, Notre Dame 8%.
- Best margin with garbage time removed: Georgia +24.9 a game, Notre Dame and Wake Forest +23.1.
- Better than their record: Ohio State is 7-4 but led 70% of the time (9th), and lost twice after leading
  by 10 or more, including a 20-point lead at Texas. Penn State is 6-5 and ranks 13th.
- Worse than their record: Washington is 7-4 while leading 34% of the time and trailing 41%. Oregon is 8-3
  with three wins after trailing by 10 or more.

**Home and away headline results:**
- Unbeaten on the road among top-50 teams: Wake Forest 6-0, Utah 5-0, Georgia 4-0, Texas 3-0. Texas led
  only 36% of its road minutes.
- Notre Dame is 6-0 at home and never trailed there.
- Northwestern led 75% of the time at home and 23% away. Ole Miss is 5-1 at home and 1-3 on the road.

## 6. This handoff

The user asked how to move the conversation into Claude Code on their laptop to build a website with this
information. This folder is that handoff: the data as JSON and CSV, a pipeline that regenerates it, and
these notes.

## What the user seems to care about

Observations from the chat, worth confirming rather than assuming:
- Having every stat for a team in one place, next to the team.
- Splitting records in unusual ways, and metrics that separate record from underlying performance.
- Reading on a phone.

## Not decided

- Everything about the site: stack, design, hosting, pages, public or private.
- Whether the site should update after new games. Week 13 games run Nov 25-29 and conference championship
  games follow. The pipeline can be re-run, with two hand-entered files to update each week.
- Which of the other metric ideas to build next.
