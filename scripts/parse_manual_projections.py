#!/usr/bin/env python3
"""
Parse manually copied projection data from Fantasy Football Pundit.
"""

import json
import re

# Raw data pasted from the website (goalkeepers)
raw_data = """
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

def parse_projections(raw_text):
    players = []
    lines = [l.strip() for l in raw_text.strip().split('\n') if l.strip()]
    
    for line in lines:
        # Split by tabs or multiple spaces
        parts = re.split(r'\t+', line)
        if len(parts) < 7:
            # Try splitting by multiple spaces if tabs don't work
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
                    'position': 'GK'  # We know this batch is goalkeepers
                })
            except Exception as e:
                print(f"Error parsing line: {line} - {e}")
    
    return players

players = parse_projections(raw_data)

print(f"✅ Parsed {len(players)} players\n")
print("Top 10 by projected points:")
print("-" * 60)
for p in sorted(players, key=lambda x: x['projected_points'], reverse=True)[:10]:
    print(f"  {p['name']:15} | {p['team']:15} | {p['projected_points']:4.1f} pts | {p['start_pct']:3d}%")

# Save to JSON
output_file = 'data/projections_gw19.json'
import os
os.makedirs('data', exist_ok=True)
with open(output_file, 'w') as f:
    json.dump({
        'gameweek': 19,
        'source': 'fantasyfootballpundit.com',
        'players': players
    }, f, indent=2)

print(f"\n💾 Saved to {output_file}")
print("\nThis can be updated weekly by pasting new data!")

