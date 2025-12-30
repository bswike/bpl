#!/usr/bin/env python3
"""
Compile all projection data from Fantasy Football Pundit into JSON.
"""

import json
import re
import os

# Raw data by position
GK_DATA = """
Lammens	Man Utd	4.2	95%	Wolves (H)	£5.0m	2.1%
Raya	Arsenal	4.1	95%	Aston Villa (H)	£6.0m	36.0%
Donnarumma	Man City	4.1	95%	Sunderland (a)	£5.7m	10.2%
A.Becker	Liverpool	4.0	95%	Leeds (H)	£5.4m	6.1%
Sanchez	Chelsea	3.7	95%	Bournemouth (H)	£4.9m	14.9%
Henderson	Crystal Palace	3.7	95%	Fulham (H)	£5.1m	8.6%
Verbruggen	Brighton	3.6	95%	West Ham (a)	£4.4m	5.5%
Kelleher	Brentford	3.6	95%	Spurs (H)	£4.5m	8.4%
Pickford	Everton	3.4	95%	Notts Forest (a)	£5.5m	11.0%
John	Notts Forest	3.3	80%	Everton (H)	£4.0m	0.4%
Vicario	Spurs	3.2	95%	Brentford (a)	£4.8m	7.0%
Leno	Fulham	3.2	95%	Crystal Palace (a)	£4.9m	1.8%
Areola	West Ham	3.0	90%	Brighton (H)	£4.3m	2.2%
Dubravka	Burnley	2.9	95%	Newcastle (H)	£4.0m	33.3%
Martinez	Aston Villa	2.8	95%	Arsenal (a)	£5.0m	3.2%
Roefs	Sunderland	2.7	95%	Man City (H)	£4.8m	9.7%
Petrovic	Bournemouth	2.7	95%	Chelsea (a)	£4.5m	5.3%
Perri	Leeds	2.7	95%	Liverpool (a)	£4.5m	0.2%
Ramsdale	Newcastle	2.6	60%	Burnley (a)	£4.8m	0.9%
Jose Sa	Wolves	1.9	70%	Man Utd (a)	£4.2m	1.0%
Pope	Newcastle	1.7	40%	Burnley (a)	£5.1m	4.6%
"""

DEF_DATA = """
Virgil	Liverpool	5.2	90%	Leeds (H)	£5.9m	24.6%
Dalot	Man Utd	5.2	90%	Wolves (H)	£4.5m	3.2%
Dorgu	Man Utd	5.2	90%	Wolves (H)	£4.1m	3.8%
Saliba	Arsenal	5.0	90%	Aston Villa (H)	£5.9m	11.5%
Schar	Newcastle	4.9	90%	Burnley (a)	£5.3m	1.7%
Thiaw	Newcastle	4.8	90%	Burnley (a)	£5.0m	2.9%
Konate	Liverpool	4.6	90%	Leeds (H)	£5.4m	3.6%
Hall	Newcastle	4.4	90%	Burnley (a)	£5.2m	1.5%
Gvardiol	Man City	4.3	80%	Sunderland (a)	£6.0m	9.6%
Guehi	Crystal Palace	4.3	90%	Fulham (H)	£5.3m	41.6%
Shaw	Man Utd	4.3	90%	Wolves (H)	£4.5m	0.7%
White	Arsenal	4.2	90%	Aston Villa (H)	£5.2m	0.8%
Milenkovic	Notts Forest	4.1	90%	Everton (H)	£5.1m	3.4%
N.Williams	Notts Forest	4.1	90%	Everton (H)	£4.7m	3.5%
Lacroix	Crystal Palace	4.1	90%	Fulham (H)	£5.2m	6.8%
Mitchell	Crystal Palace	4.0	90%	Fulham (H)	£5.0m	2.4%
Murillo	Notts Forest	4.0	90%	Everton (H)	£5.2m	1.9%
Chalobah	Chelsea	3.9	80%	Bournemouth (H)	£5.5m	19.4%
Collins	Brentford	3.8	90%	Spurs (H)	£4.9m	1.6%
Tarkowski	Everton	3.7	90%	Notts Forest (a)	£5.5m	8.1%
J.Timber	Arsenal	3.6	60%	Aston Villa (H)	£6.5m	31.7%
Van Hecke	Brighton	3.6	90%	West Ham (a)	£4.5m	4.0%
Keane	Everton	3.6	90%	Notts Forest (a)	£4.8m	6.1%
Andersen	Fulham	3.5	90%	Crystal Palace (a)	£4.6m	6.5%
Pedro Porro	Spurs	3.5	90%	Brentford (a)	£5.2m	12.6%
Calafiori	Arsenal	3.3	60%	Aston Villa (H)	£5.7m	10.1%
Romero	Spurs	3.3	90%	Brentford (a)	£5.0m	3.6%
Van de Ven	Spurs	3.1	80%	Brentford (a)	£4.5m	26.2%
Gabriel	Arsenal	3.0	50%	Aston Villa (H)	£6.2m	13.1%
Cucurella	Chelsea	2.8	60%	Bournemouth (H)	£6.2m	21.7%
Senesi	Bournemouth	2.7	90%	Chelsea (a)	£4.9m	16.3%
Konsa	Aston Villa	2.2	90%	Arsenal (a)	£4.4m	7.5%
"""

MID_DATA = """
Cunha	Man Utd	7.2	90%	Wolves (H)	£8.1m	10.5%
Palmer	Chelsea	5.8	90%	Bournemouth (H)	£10.4m	11.8%
Saka	Arsenal	5.5	90%	Aston Villa (H)	£10.3m	21.7%
Foden	Man City	5.2	80%	Sunderland (a)	£9.0m	41.1%
Wirtz	Liverpool	5.2	90%	Leeds (H)	£8.1m	10.4%
Schade	Brentford	5.0	90%	Spurs (H)	£7.0m	1.3%
Semenyo	Bournemouth	4.8	90%	Chelsea (a)	£7.7m	47.0%
Gibbs-White	Notts Forest	4.7	90%	Everton (H)	£7.3m	2.8%
Rice	Arsenal	4.6	90%	Aston Villa (H)	£7.2m	26.1%
Casemiro	Man Utd	4.5	90%	Wolves (H)	£5.5m	1.2%
Enzo	Chelsea	4.4	80%	Bournemouth (H)	£6.5m	9.5%
Szoboszlai	Liverpool	4.4	80%	Leeds (H)	£6.6m	4.4%
Minteh	Brighton	4.4	90%	West Ham (a)	£6.0m	6.3%
Gordon	Newcastle	4.1	80%	Burnley (a)	£7.4m	4.5%
Wilson	Fulham	4.1	90%	Crystal Palace (a)	£5.8m	18.5%
Caicedo	Chelsea	4.1	90%	Bournemouth (H)	£5.7m	8.8%
Tavernier	Bournemouth	4.1	90%	Chelsea (a)	£5.6m	3.1%
Anderson	Notts Forest	4.1	90%	Everton (H)	£5.3m	4.7%
Kudus	Spurs	4.0	90%	Brentford (a)	£6.4m	14.2%
Gravenberch	Liverpool	3.9	90%	Leeds (H)	£5.7m	5.9%
Cherki	Man City	3.7	80%	Sunderland (a)	£6.7m	11.0%
Trossard	Arsenal	3.5	60%	Aston Villa (H)	£6.9m	1.0%
Mac Allister	Liverpool	3.5	80%	Leeds (H)	£6.2m	1.4%
Bruno G.	Newcastle	3.5	80%	Burnley (a)	£7.0m	13.6%
Wharton	Crystal Palace	3.4	90%	Fulham (H)	£5.0m	0.9%
Gakpo	Liverpool	3.3	50%	Leeds (H)	£7.3m	5.3%
Odegaard	Arsenal	3.3	70%	Aston Villa (H)	£7.8m	1.7%
Grealish	Everton	3.1	70%	Notts Forest (a)	£6.5m	10.4%
Rogers	Aston Villa	3.1	90%	Arsenal (a)	£7.4m	22.7%
Eze	Arsenal	2.4	40%	Aston Villa (H)	£7.5m	13.4%
Salah	Liverpool	0.0	0%	Leeds (H)	£13.5m	50.0%
"""

FWD_DATA = """
Haaland	Man City	7.1	90%	Sunderland (a)	£15.1m	74.2%
Ekitike	Liverpool	6.6	90%	Leeds (H)	£9.1m	34.7%
Thiago	Brentford	5.5	90%	Spurs (H)	£7.0m	29.1%
Mateta	Crystal Palace	4.9	90%	Fulham (H)	£7.7m	12.7%
Sesko	Man Utd	4.5	80%	Wolves (H)	£7.2m	3.2%
Bowen	West Ham	4.5	90%	Brighton (H)	£7.6m	7.2%
Woltemade	Newcastle	4.3	70%	Burnley (a)	£7.4m	18.9%
Joao Pedro	Chelsea	4.3	80%	Bournemouth (H)	£7.2m	28.7%
Igor Jesus	Notts Forest	3.8	90%	Everton (H)	£5.8m	1.2%
Raul	Fulham	3.7	90%	Crystal Palace (a)	£6.3m	2.4%
Strand Larsen	Wolves	3.6	90%	Man Utd (a)	£6.1m	0.9%
Gyokeres	Arsenal	3.5	70%	Aston Villa (H)	£8.8m	10.0%
Calvert-Lewin	Leeds	3.5	90%	Liverpool (a)	£5.8m	8.7%
Welbeck	Brighton	3.2	60%	West Ham (a)	£6.3m	4.8%
Watkins	Aston Villa	3.2	90%	Arsenal (a)	£8.5m	7.3%
Richarlison	Spurs	2.9	60%	Brentford (a)	£6.4m	7.7%
Evanilson	Bournemouth	2.7	70%	Chelsea (a)	£7.0m	1.7%
Wood	Notts Forest	1.6	70%	Everton (H)	£7.2m	4.9%
Isak	Liverpool	0.0	0%	Leeds (H)	£10.3m	3.9%
"""

def parse_players(raw_text, position):
    players = []
    lines = [l.strip() for l in raw_text.strip().split('\n') if l.strip()]
    
    for line in lines:
        parts = re.split(r'\t+', line)
        if len(parts) < 6:
            parts = re.split(r'\s{2,}', line)
        
        if len(parts) >= 6:
            try:
                name = parts[0].strip()
                team = parts[1].strip().replace(' badge', '')
                predicted_pts = float(parts[2].strip())
                start_pct = int(parts[3].replace('%', '').strip())
                fixture = parts[4].strip()
                price = float(parts[5].replace('£', '').replace('m', '').strip())
                pick_pct = float(parts[6].replace('%', '').strip()) if len(parts) > 6 else 0
                
                players.append({
                    'name': name,
                    'team': team,
                    'projected_points': predicted_pts,
                    'start_pct': start_pct,
                    'next_fixture': fixture,
                    'price': price,
                    'pick_pct': pick_pct,
                    'position': position
                })
            except Exception as e:
                print(f"Error parsing: {line[:50]}... - {e}")
    
    return players

# Parse all positions
all_players = []
all_players.extend(parse_players(GK_DATA, 'GK'))
all_players.extend(parse_players(DEF_DATA, 'DEF'))
all_players.extend(parse_players(MID_DATA, 'MID'))
all_players.extend(parse_players(FWD_DATA, 'FWD'))

print(f"✅ Parsed {len(all_players)} total players")
print(f"   GK: {len([p for p in all_players if p['position'] == 'GK'])}")
print(f"   DEF: {len([p for p in all_players if p['position'] == 'DEF'])}")
print(f"   MID: {len([p for p in all_players if p['position'] == 'MID'])}")
print(f"   FWD: {len([p for p in all_players if p['position'] == 'FWD'])}")

# Show top projected players
print("\n🌟 Top 15 Projected Players for GW19:")
print("-" * 70)
sorted_players = sorted(all_players, key=lambda x: x['projected_points'], reverse=True)
for i, p in enumerate(sorted_players[:15], 1):
    print(f"  {i:2}. {p['name']:20} ({p['position']:3}) | {p['projected_points']:4.1f} pts | {p['team']:15} | {p['start_pct']:3}%")

# Save to JSON
os.makedirs('data', exist_ok=True)
output = {
    'gameweek': 19,
    'source': 'fantasyfootballpundit.com',
    'updated': '2024-12-30',
    'players': all_players
}

with open('data/projections_gw19.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n💾 Saved to data/projections_gw19.json")

# Create a lookup by player name for easy integration
lookup = {p['name'].lower(): p for p in all_players}
with open('data/projections_lookup.json', 'w') as f:
    json.dump(lookup, f, indent=2)

print(f"💾 Saved lookup to data/projections_lookup.json")

