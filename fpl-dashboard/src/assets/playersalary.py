import requests, pandas as pd

u = "https://fantasy.premierleague.com/api/bootstrap-static/"
data = requests.get(u, timeout=20).json()

players = pd.DataFrame(data["elements"])
teams = pd.DataFrame(data["teams"])[["id","name"]].rename(columns={"id":"team"})
positions = pd.DataFrame(data["element_types"])[["id","singular_name_short"]].rename(columns={"id":"element_type"})

df = (players[["id","web_name","team","element_type","now_cost"]]
      .merge(teams, on="team")
      .merge(positions, on="element_type"))

df.rename(columns={"name":"team_name","singular_name_short":"position"}, inplace=True)
df["price_now"] = df["now_cost"] / 10  # £m
out = df[["id","web_name","team_name","position","price_now"]].sort_values(["position","price_now","web_name"])

out.to_csv("fpl_players_prices.csv", index=False)
print("Wrote fpl_players_prices.csv with", len(out), "players")
