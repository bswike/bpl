import { useState, useMemo } from "react";

const CHAMPIONS = [
  { year: 2017, golfer: "Sergio Garcia", owner: "Joe Mangione / Brian Gibbons", price: 36, payout: 607.50, pot: 1350, field: 41 },
  { year: 2018, golfer: "Patrick Reed", owner: "Steve Licata", price: 35, payout: 1042.65, pot: 2317, field: 44 },
  { year: 2019, golfer: "Tiger Woods", owner: "Taylor Smyth", price: 76, payout: 675.45, pot: 1501, field: 44 },
  { year: 2021, golfer: "Hideki Matsuyama", owner: "Peter Berger", price: 37, payout: 860.40, pot: 1912, field: 44 },
  { year: 2022, golfer: "Scottie Scheffler", owner: "Steve Licata", price: 101, payout: 660.15, pot: 1467, field: 42 },
  { year: 2023, golfer: "Jon Rahm", owner: "Brian Gibbons", price: 72, payout: 603, pot: 1340, field: 42 },
  { year: 2024, golfer: "Scottie Scheffler", owner: "Peter Berger", price: 262, payout: 945.90, pot: 2102, field: 42 },
  { year: 2025, golfer: "Rory McIlroy", owner: "Scott Block", price: 170, payout: 921.15, pot: 2047, field: 44 },
];

const TOP_FINISHES = [
  { year: 2017, results: [
    { pos: "1st", golfer: "Sergio Garcia", owner: "Joe Mangione / Brian Gibbons", payout: 607.50 },
    { pos: "2nd", golfer: "Justin Rose", owner: "Adam Yeager", payout: 337.50 },
    { pos: "3rd", golfer: "Charl Schwartzel", owner: "Brian Black", payout: 202.50 },
    { pos: "T4", golfer: "Matt Kuchar", owner: "Bobby Reagan", payout: 101.25 },
    { pos: "T4", golfer: "Thomas Pieters", owner: "Adam Yeager", payout: 101.25 },
  ]},
  { year: 2018, results: [
    { pos: "1st", golfer: "Patrick Reed", owner: "Steve Licata", payout: 1042.65 },
    { pos: "2nd", golfer: "Rickie Fowler", owner: "Pat Fitzgerald", payout: 579.25 },
    { pos: "3rd", golfer: "Jordan Spieth", owner: "Joe Mangione", payout: 347.55 },
    { pos: "4th", golfer: "Jon Rahm", owner: "Brian Black", payout: 231.70 },
    { pos: "T5", golfer: "Bubba Watson", owner: "Nick Mangione", payout: 28.96 },
  ]},
  { year: 2019, results: [
    { pos: "1st", golfer: "Tiger Woods", owner: "Taylor Smyth", payout: 675.45 },
    { pos: "T2", golfer: "Dustin Johnson", owner: "Steve Childres", payout: 250.17 },
    { pos: "T2", golfer: "Xander Schauffele", owner: "Taylor Smyth", payout: 250.17 },
    { pos: "T2", golfer: "Brooks Koepka", owner: "Ryan Lee", payout: 250.17 },
    { pos: "T5", golfer: "Jason Day", owner: "Brian Black", payout: 18.76 },
  ]},
  { year: 2021, results: [
    { pos: "1st", golfer: "Hideki Matsuyama", owner: "Peter Berger", payout: 860.40 },
    { pos: "2nd", golfer: "Will Zalatoris", owner: "Taylor Smyth / Ryan Lee", payout: 478 },
    { pos: "T3", golfer: "Jordan Spieth", owner: "Joe Mangione", payout: 239 },
    { pos: "T3", golfer: "Xander Schauffele", owner: "Steve Licata", payout: 239 },
    { pos: "T5", golfer: "Jon Rahm", owner: "Joe Curran", payout: 47.80 },
  ]},
  { year: 2022, results: [
    { pos: "1st", golfer: "Scottie Scheffler", owner: "Steve Licata", payout: 660.15 },
    { pos: "2nd", golfer: "Rory McIlroy", owner: "Joe Mangione", payout: 366.75 },
    { pos: "T3", golfer: "Shane Lowry", owner: "Steve Licata", payout: 220.05 },
    { pos: "T3", golfer: "Cameron Smith", owner: "Brian Gibbons", payout: 183.38 },
    { pos: "5th", golfer: "Collin Morikawa", owner: "Michael Myers", payout: 73.35 },
  ]},
  { year: 2023, results: [
    { pos: "1st", golfer: "Jon Rahm", owner: "Brian Gibbons", payout: 603 },
    { pos: "T2", golfer: "Phil Mickelson", owner: "Kyle Rajotte", payout: 268 },
    { pos: "T2", golfer: "Brooks Koepka", owner: "Ryan Lee", payout: 268 },
    { pos: "T4", golfer: "Jordan Spieth", owner: "Joe Mangione", payout: 67 },
    { pos: "T4", golfer: "Patrick Reed", owner: "Joe Curran", payout: 67 },
  ]},
  { year: 2024, results: [
    { pos: "1st", golfer: "Scottie Scheffler", owner: "Peter Berger", payout: 945.90 },
    { pos: "2nd", golfer: "Ludvig Åberg", owner: "Joe Curran", payout: 525.50 },
    { pos: "T3", golfer: "Tommy Fleetwood", owner: "Nick Mangione", payout: 210.20 },
    { pos: "T3", golfer: "Max Homa", owner: "Alex Carroll", payout: 210.20 },
    { pos: "T3", golfer: "Collin Morikawa", owner: "Steve Licata", payout: 210.20 },
  ]},
  { year: 2025, results: [
    { pos: "1st", golfer: "Rory McIlroy", owner: "Scott Block", payout: 921.15 },
    { pos: "2nd", golfer: "Justin Rose", owner: "Peter Berger", payout: 511.75 },
    { pos: "3rd", golfer: "Patrick Reed", owner: "Joe Curran", payout: 307.05 },
    { pos: "4th", golfer: "Scottie Scheffler", owner: "Peter Berger", payout: 204.70 },
    { pos: "T5", golfer: "Sungjae Im", owner: "Ryan Lee", payout: 51.18 },
  ]},
];

const ALL_TIME = [
  { name: "Peter Berger", years: 6, spent: 1137, won: 2523, net: 1386 },
  { name: "Scott Block", years: 3, spent: 338, won: 972, net: 634 },
  { name: "Adam Yeager", years: 1, spent: 79, won: 439, net: 360 },
  { name: "Ryan Lee", years: 7, spent: 501, won: 797, net: 296 },
  { name: "Alex Carroll", years: 3, spent: 95, won: 210, net: 115 },
  { name: "Kyle Rajotte", years: 3, spent: 269, won: 335, net: 66 },
  { name: "Brian Gibbons", years: 8, spent: 806, won: 907, net: 101 },
  { name: "Joe Mangione", years: 8, spent: 1271, won: 1324, net: 53 },
  { name: "Chase Cusack", years: 1, spent: 16, won: 0, net: -16 },
  { name: "Michael Butta", years: 1, spent: 11, won: 0, net: -11 },
  { name: "Michael Toomer", years: 1, spent: 52, won: 0, net: -52 },
  { name: "Anthony Meek", years: 2, spent: 54, won: 0, net: -54 },
  { name: "Brian Nickel", years: 3, spent: 93, won: 0, net: -93 },
  { name: "Pat Fitzgerald", years: 3, spent: 186, won: 579, net: 394 },
  { name: "Steve Childres", years: 2, spent: 177, won: 250, net: 73 },
  { name: "Bobby Reagan", years: 3, spent: 307, won: 101, net: -206 },
  { name: "Shane Griffith", years: 1, spent: 212, won: 0, net: -212 },
  { name: "JP Fischer", years: 3, spent: 237, won: 0, net: -237 },
  { name: "Jimmy Tangires", years: 2, spent: 249, won: 0, net: -249 },
  { name: "Joe Curran", years: 5, spent: 1255, won: 947, net: -308 },
  { name: "Nick Mangione", years: 5, spent: 542, won: 449, net: -93 },
  { name: "Erik Cobuzzi", years: 3, spent: 336, won: 0, net: -336 },
  { name: "Brandon Call", years: 3, spent: 444, won: 0, net: -444 },
  { name: "Taylor Smyth", years: 6, spent: 1135, won: 1164, net: 29 },
  { name: "Brian Black", years: 5, spent: 1107, won: 502, net: -605 },
  { name: "Steve Licata", years: 8, spent: 1390, won: 2372, net: 982 },
  { name: "Michael Myers", years: 8, spent: 1739, won: 73, net: -1666 },
].sort((a, b) => b.net - a.net);

const GOLFERS_2026 = [
  { name: "Scottie Scheffler", odds: "+500" },
  { name: "Jon Rahm", odds: "+700" },
  { name: "Rory McIlroy", odds: "+900" },
  { name: "Bryson DeChambeau", odds: "+900" },
  { name: "Xander Schauffele", odds: "16/1" },
  { name: "Ludvig Åberg", odds: "16/1" },
  { name: "Cameron Young", odds: "20/1" },
  { name: "Matt Fitzpatrick", odds: "22/1" },
  { name: "Tommy Fleetwood", odds: "22/1" },
  { name: "Robert MacIntyre", odds: "30/1" },
  { name: "Justin Rose", odds: "30/1" },
  { name: "Collin Morikawa", odds: "33/1" },
  { name: "Hideki Matsuyama", odds: "35/1" },
  { name: "Patrick Reed", odds: "35/1" },
  { name: "Min Woo Lee", odds: "35/1" },
  { name: "Chris Gotterup", odds: "45/1" },
  { name: "Sam Burns", odds: "45/1" },
  { name: "Joaquin Niemann", odds: "45/1" },
  { name: "Cameron Smith", odds: "50/1" },
  { name: "Tony Finau", odds: "50/1" },
  { name: "Jason Day", odds: "50/1" },
  { name: "Russell Henley", odds: "55/1" },
  { name: "Wyndham Clark", odds: "55/1" },
  { name: "Dustin Johnson", odds: "55/1" },
  { name: "Adam Scott", odds: "55/1" },
  { name: "Sungjae Im", odds: "55/1" },
  { name: "Patrick Cantlay", odds: "60/1" },
  { name: "Brooks Koepka", odds: "60/1" },
  { name: "Viktor Hovland", odds: "60/1" },
  { name: "Jordan Spieth", odds: "60/1" },
  { name: "Justin Thomas", odds: "60/1" },
  { name: "Shane Lowry", odds: "60/1" },
  { name: "Brian Harman", odds: "80/1" },
  { name: "Tom Kim", odds: "80/1" },
  { name: "Keegan Bradley", odds: "80/1" },
  { name: "Si Woo Kim", odds: "80/1" },
  { name: "Nick Dunlap", odds: "80/1" },
  { name: "Tiger Woods", odds: "80/1" },
  { name: "Phil Mickelson", odds: "100/1" },
  { name: "Sergio Garcia", odds: "100/1" },
  { name: "Maverick McNealy", odds: "100/1" },
  { name: "Daniel Berger", odds: "100/1" },
  { name: "The Field", odds: "—" },
];

const PARTICIPANTS_2026 = [
  "Alex Carroll", "Anthony Meek", "Brian Black", "Brian Gibbons", "Chase Cusack",
  "Joe Curran", "Joe Mangione", "JP Fischer", "Michael Myers", "Nick Mangione",
  "Patrick Dugan", "Peter Berger", "Ryan Lee", "Scott Block", "Steve Licata",
  "Taylor Smyth", "Erik Cobuzzi", "Kyle Rajotte",
];

const AUCTION_DATA = {
  2017: [
    {g:"Jordan Spieth",o:"Joe Mangione",p:152},{g:"Dustin Johnson",o:"Peter Berger",p:135},{g:"The Field",o:"Brian Black",p:165},
    {g:"Rory McIlroy",o:"Pat Fitzgerald",p:91},{g:"Bobby Reagan",o:"Bobby Reagan",p:92},{g:"Peter Berger",o:"Peter Berger",p:86},
    {g:"Jason Day",o:"Steve Licata",p:75},{g:"Phil Mickelson",o:"Michael Myers",p:42},{g:"Rickie Fowler",o:"Nick Mangione",p:46},
    {g:"Hideki Matsuyama",o:"Steve Licata",p:45},{g:"Jon Rahm",o:"Pat Fitzgerald",p:40},{g:"Justin Rose",o:"Adam Yeager",p:37},
    {g:"Sergio Garcia",o:"Joe Mangione",p:36},{g:"Justin Thomas",o:"Alex Carroll",p:35},{g:"Adam Scott",o:"Steve Licata",p:33},
    {g:"Henrik Stenson",o:"Brian Black",p:35},{g:"Bubba Watson",o:"Brian Nickel",p:28},{g:"Brooks Koepka",o:"Nick Mangione",p:18},
    {g:"Patrick Reed",o:"Brian Black",p:20},{g:"Paul Casey",o:"Brian Gibbons",p:21},{g:"Matt Kuchar",o:"Bobby Reagan",p:25},
    {g:"Daniel Berger",o:"Adam Yeager",p:16},{g:"Tommy Fleetwood",o:"Bobby Reagan",p:9},
  ],
  2018: [
    {g:"Tiger Woods",o:"Jimmy Tangires",p:208},{g:"Justin Thomas",o:"Steve Licata",p:183},{g:"Jordan Spieth",o:"Joe Mangione",p:169},
    {g:"Dustin Johnson",o:"Shane Griffith",p:140},{g:"Rory McIlroy",o:"Brian Black",p:135},{g:"The Field",o:"Michael Myers",p:200},
    {g:"Bubba Watson",o:"Nick Mangione",p:91},{g:"Justin Rose",o:"Brian Black",p:90},{g:"Rickie Fowler",o:"Pat Fitzgerald",p:80},
    {g:"Paul Casey",o:"JP Fischer",p:81},{g:"Jon Rahm",o:"Brian Black",p:69},{g:"Jason Day",o:"Bobby Reagan",p:70},
    {g:"Phil Mickelson",o:"Steve Childres",p:72},{g:"Sergio Garcia",o:"Michael Myers",p:35},{g:"Hideki Matsuyama",o:"Brian Gibbons",p:50},
    {g:"Patrick Reed",o:"Steve Licata",p:48},{g:"Tommy Fleetwood",o:"Bobby Reagan",p:45},{g:"Adam Scott",o:"Steve Licata",p:25},
  ],
  2019: [
    {g:"Rory McIlroy",o:"Erik Cobuzzi",p:90},{g:"Dustin Johnson",o:"Steve Childres",p:85},{g:"Justin Rose",o:"Brian Black",p:88},
    {g:"Tiger Woods",o:"Taylor Smyth",p:76},{g:"Jordan Spieth",o:"Joe Mangione",p:71},{g:"Brooks Koepka",o:"Ryan Lee",p:77},
    {g:"The Field",o:"Joe Mangione",p:95},{g:"Justin Thomas",o:"Michael Myers",p:82},{g:"Rickie Fowler",o:"Brian Gibbons",p:69},
    {g:"Jon Rahm",o:"Michael Myers",p:45},{g:"Bryson DeChambeau",o:"Michael Myers",p:38},{g:"Tommy Fleetwood",o:"Bobby Reagan",p:41},
    {g:"Xander Schauffele",o:"Taylor Smyth",p:30},{g:"Tony Finau",o:"Steve Licata",p:38},{g:"Patrick Reed",o:"Joe Mangione",p:20},
    {g:"Hideki Matsuyama",o:"Bobby Reagan",p:40},{g:"Adam Scott",o:"Brian Black",p:30},{g:"Jason Day",o:"Brian Black",p:40},
  ],
  2021: [
    {g:"Dustin Johnson",o:"Brian Black",p:155},{g:"Jordan Spieth",o:"Joe Mangione",p:145},{g:"Justin Thomas",o:"Michael Myers",p:140},
    {g:"Bryson DeChambeau",o:"Michael Myers",p:138},{g:"Jon Rahm",o:"Joe Curran",p:105},{g:"The Field",o:"Brian Black",p:95},
    {g:"Rory McIlroy",o:"Taylor Smyth",p:80},{g:"Patrick Cantlay",o:"Brandon Call",p:80},{g:"Xander Schauffele",o:"Steve Licata",p:80},
    {g:"Collin Morikawa",o:"Taylor Smyth",p:80},{g:"Brooks Koepka",o:"Ryan Lee",p:61},{g:"Patrick Reed",o:"Brandon Call",p:60},
    {g:"Tony Finau",o:"Steve Licata",p:52},{g:"Cameron Smith",o:"Joe Curran",p:40},{g:"Viktor Hovland",o:"Peter Berger",p:37},
    {g:"Hideki Matsuyama",o:"Peter Berger",p:29},{g:"Scottie Scheffler",o:"Taylor Smyth",p:30},
  ],
  2022: [
    {g:"Justin Thomas",o:"Joe Mangione",p:107},{g:"Scottie Scheffler",o:"Steve Licata",p:101},{g:"Jon Rahm",o:"Michael Myers",p:98},
    {g:"Dustin Johnson",o:"Joe Curran",p:97},{g:"Cameron Smith",o:"Brian Gibbons",p:83},{g:"The Field",o:"Peter Berger",p:75},
    {g:"Brooks Koepka",o:"Ryan Lee",p:72},{g:"Jordan Spieth",o:"Joe Mangione",p:69},{g:"Xander Schauffele",o:"Brandon Call",p:65},
    {g:"Rory McIlroy",o:"Joe Mangione",p:55},{g:"Collin Morikawa",o:"Michael Myers",p:53},{g:"Patrick Cantlay",o:"Taylor Smyth",p:50},
    {g:"Viktor Hovland",o:"Joe Curran",p:45},{g:"Will Zalatoris",o:"Joe Mangione",p:35},{g:"Tony Finau",o:"Joe Curran",p:30},
    {g:"Tiger Woods",o:"Joe Mangione",p:26},{g:"Hideki Matsuyama",o:"Brian Gibbons",p:25},{g:"Shane Lowry",o:"Steve Licata",p:16},
  ],
  2023: [
    {g:"Scottie Scheffler",o:"Joe Curran",p:101},{g:"Rory McIlroy",o:"Steve Licata",p:80},{g:"Jon Rahm",o:"Brian Gibbons",p:72},
    {g:"Cameron Smith",o:"Joe Curran",p:60},{g:"Jordan Spieth",o:"Joe Mangione",p:57},{g:"Collin Morikawa",o:"Brandon Call",p:55},
    {g:"Patrick Cantlay",o:"Nick Mangione",p:52},{g:"Justin Thomas",o:"Brian Gibbons",p:52},{g:"Tony Finau",o:"Steve Licata",p:46},
    {g:"Xander Schauffele",o:"Taylor Smyth",p:45},{g:"The Field",o:"Kyle Rajotte",p:42},{g:"Brooks Koepka",o:"Ryan Lee",p:41},
    {g:"Dustin Johnson",o:"Joe Curran",p:38},{g:"Max Homa",o:"Brian Gibbons",p:34},{g:"Hideki Matsuyama",o:"Brian Gibbons",p:25},
    {g:"Patrick Reed",o:"Joe Curran",p:21},{g:"Shane Lowry",o:"Ryan Lee",p:21},{g:"Tommy Fleetwood",o:"Steve Licata",p:30},
  ],
  2024: [
    {g:"Scottie Scheffler",o:"Peter Berger",p:262},{g:"The Field",o:"Kyle Rajotte",p:162},{g:"Jon Rahm",o:"Nick Mangione",p:142},
    {g:"Xander Schauffele",o:"Taylor Smyth",p:135},{g:"Rory McIlroy",o:"Joe Curran",p:131},{g:"Jordan Spieth",o:"Joe Mangione",p:85},
    {g:"Hideki Matsuyama",o:"Peter Berger",p:84},{g:"Brooks Koepka",o:"Taylor Smyth",p:82},{g:"Joaquin Niemann",o:"Steve Licata",p:70},
    {g:"Will Zalatoris",o:"Erik Cobuzzi",p:61},{g:"Viktor Hovland",o:"Michael Myers",p:56},{g:"Wyndham Clark",o:"Joe Curran",p:50},
    {g:"Ludvig Åberg",o:"Joe Curran",p:47},{g:"Bryson DeChambeau",o:"Brian Gibbons",p:46},{g:"Dustin Johnson",o:"Michael Myers",p:46},
    {g:"Tommy Fleetwood",o:"Nick Mangione",p:39},{g:"Patrick Reed",o:"Joe Curran",p:13},{g:"Max Homa",o:"Alex Carroll",p:26},
  ],
  2025: [
    {g:"Scottie Scheffler",o:"Peter Berger",p:220},{g:"Rory McIlroy",o:"Scott Block",p:170},{g:"Collin Morikawa",o:"Joe Curran",p:112},
    {g:"Jon Rahm",o:"Michael Myers",p:102},{g:"The Field",o:"Steve Licata",p:100},{g:"Ludvig Åberg",o:"Michael Myers",p:95},
    {g:"Bryson DeChambeau",o:"Scott Block",p:80},{g:"Xander Schauffele",o:"Taylor Smyth",p:75},{g:"Justin Thomas",o:"Nick Mangione",p:66},
    {g:"Jordan Spieth",o:"Brian Gibbons",p:64},{g:"Brooks Koepka",o:"Taylor Smyth",p:60},{g:"Viktor Hovland",o:"Erik Cobuzzi",p:56},
    {g:"Hideki Matsuyama",o:"Peter Berger",p:55},{g:"Joaquin Niemann",o:"Taylor Smyth",p:53},{g:"Shane Lowry",o:"Michael Myers",p:52},
    {g:"Tommy Fleetwood",o:"Joe Curran",p:46},{g:"Patrick Reed",o:"Joe Curran",p:15},{g:"Justin Rose",o:"Peter Berger",p:13},
  ],
};

const REPEAT_BUYS = [
  { owner: "Joe Mangione", golfer: "Jordan Spieth", times: 6, years: [2017,2019,2021,2022,2023,2024], avgPrice: 96 },
  { owner: "Taylor Smyth", golfer: "Xander Schauffele", times: 4, years: [2019,2023,2024,2025], avgPrice: 71 },
  { owner: "Ryan Lee", golfer: "Brooks Koepka", times: 4, years: [2019,2021,2022,2023], avgPrice: 63 },
  { owner: "Peter Berger", golfer: "Hideki Matsuyama", times: 3, years: [2021,2024,2025], avgPrice: 56 },
  { owner: "Bobby Reagan", golfer: "Tommy Fleetwood", times: 3, years: [2017,2018,2019], avgPrice: 32 },
  { owner: "Joe Curran", golfer: "Patrick Reed", times: 3, years: [2023,2024,2025], avgPrice: 16 },
  { owner: "Peter Berger", golfer: "Scottie Scheffler", times: 2, years: [2024,2025], avgPrice: 241 },
  { owner: "Brian Gibbons", golfer: "Hideki Matsuyama", times: 3, years: [2018,2022,2023], avgPrice: 33 },
  { owner: "Michael Myers", golfer: "Jon Rahm", times: 3, years: [2019,2022,2025], avgPrice: 82 },
  { owner: "Steve Licata", golfer: "Adam Scott", times: 2, years: [2017,2018], avgPrice: 29 },
  { owner: "Brian Black", golfer: "Justin Rose", times: 3, years: [2018,2019,2021], avgPrice: 104 },
  { owner: "Joe Mangione", golfer: "Justin Thomas", times: 2, years: [2022,2021], avgPrice: 124 },
];

const GOLFER_HISTORIES = [
  { golfer: "Scottie Scheffler", data: [{y:2021,p:30},{y:2022,p:101},{y:2023,p:101},{y:2024,p:262},{y:2025,p:220}] },
  { golfer: "Jon Rahm", data: [{y:2017,p:40},{y:2018,p:69},{y:2019,p:45},{y:2021,p:105},{y:2022,p:98},{y:2023,p:72},{y:2024,p:142},{y:2025,p:102}] },
  { golfer: "Rory McIlroy", data: [{y:2017,p:91},{y:2018,p:135},{y:2019,p:90},{y:2021,p:80},{y:2022,p:55},{y:2023,p:80},{y:2024,p:131},{y:2025,p:170}] },
  { golfer: "Tiger Woods", data: [{y:2018,p:208},{y:2019,p:76},{y:2022,p:26},{y:2023,p:22},{y:2024,p:18}] },
  { golfer: "Dustin Johnson", data: [{y:2017,p:135},{y:2018,p:140},{y:2019,p:85},{y:2021,p:155},{y:2022,p:97},{y:2023,p:38},{y:2024,p:46},{y:2025,p:16}] },
  { golfer: "Jordan Spieth", data: [{y:2017,p:152},{y:2019,p:71},{y:2021,p:145},{y:2022,p:69},{y:2023,p:57},{y:2024,p:85},{y:2025,p:64}] },
  { golfer: "Brooks Koepka", data: [{y:2017,p:18},{y:2019,p:77},{y:2021,p:61},{y:2022,p:72},{y:2023,p:41},{y:2024,p:82},{y:2025,p:60}] },
  { golfer: "Xander Schauffele", data: [{y:2018,p:11},{y:2019,p:30},{y:2021,p:80},{y:2022,p:65},{y:2023,p:45},{y:2024,p:135},{y:2025,p:75}] },
  { golfer: "Patrick Reed", data: [{y:2017,p:20},{y:2018,p:48},{y:2019,p:20},{y:2021,p:60},{y:2022,p:16},{y:2023,p:21},{y:2024,p:13},{y:2025,p:15}] },
  { golfer: "Hideki Matsuyama", data: [{y:2017,p:45},{y:2018,p:50},{y:2019,p:40},{y:2021,p:29},{y:2022,p:25},{y:2023,p:25},{y:2024,p:84},{y:2025,p:55}] },
];

const augustaGreen = "#006747";
const gold = "#ffd700";
const darkBg = "#0a1208";
const cardBg = "#111f14";
const borderColor = "#1a3320";

export default function MastersCalcutta() {
  const [tab, setTab] = useState("home");
  const [selectedYear, setSelectedYear] = useState(null);
  const [lbSort, setLbSort] = useState({ key: "net", dir: "desc" });

  const sortedBoard = useMemo(() => {
    const k = lbSort.key;
    return [...ALL_TIME].sort((a, b) => lbSort.dir === "desc" ? b[k] - a[k] : a[k] - b[k]);
  }, [lbSort]);

  const [selectedGolfer, setSelectedGolfer] = useState(null);

  const tabs = [
    { key: "home", label: "Home" },
    { key: "results", label: "Results" },
    { key: "strategies", label: "Strategies" },
    { key: "leaderboard", label: "All-Time" },
    { key: "preview", label: "2026" },
  ];

  const potData = CHAMPIONS.map(c => ({ year: c.year, pot: c.pot }));
  const maxPot = Math.max(...potData.map(p => p.pot));

  const funStats = [
    { label: "Biggest Single Win", value: "$1,042.65", sub: "Steve Licata · Patrick Reed · 2018", icon: "💰" },
    { label: "Best All-Time ROI", value: "+455%", sub: "Adam Yeager · 1 year, $79 spent", icon: "📈" },
    { label: "Biggest Auction Spend (1 yr)", value: "$500", sub: "Peter Berger · 2024", icon: "🔥" },
    { label: "Most Green Jackets Owned", value: "3", sub: "Steve Licata ('18, '22) & Peter Berger ('21, '24)", icon: "🧥" },
    { label: "Cheapest Champion", value: "$35", sub: "Patrick Reed for Steve Licata · 2018", icon: "🎯" },
    { label: "Most Expensive Champion", value: "$262", sub: "Scottie Scheffler for Peter Berger · 2024", icon: "💎" },
    { label: "All-Time Money Pit", value: "-$1,666", sub: "Michael Myers · 8 years, $73 won", icon: "🕳️" },
    { label: "Most Years Participated", value: "8", sub: "Brian Gibbons, Joe Mangione, Steve Licata, Michael Myers", icon: "🏌️" },
    { label: "Tiger Tax", value: "$76", sub: "Taylor Smyth bought Tiger at 14/1 in 2019 — worth every cent", icon: "🐯" },
    { label: "Average Pot Size", value: "$1,755", sub: "Across 8 Masters auctions (2017-2025)", icon: "🏦" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: darkBg, color: "#e8e6e3", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
        .masters-gold { color: ${gold}; }
        .masters-green { color: ${augustaGreen}; }
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${augustaGreen}, #004d35, #002a1c)`, padding: "24px 16px 16px", textAlign: "center", borderBottom: `2px solid ${gold}33` }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: `${gold}99`, fontWeight: 600, marginBottom: 2 }}>A TRADITION UNLIKE ANY OTHER</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>Masters Calcutta</div>
        <div style={{ fontSize: 11, color: "#a8d5ba", marginTop: 4 }}>Augusta National Golf Club · Est. 2017</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "8px 8px 0", background: "#0d170f", borderBottom: `1px solid ${borderColor}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "6px 14px", background: "transparent", border: "none",
            borderBottom: tab === t.key ? `2px solid ${augustaGreen}` : "2px solid transparent",
            color: tab === t.key ? "#fff" : "#5a7a60", fontSize: 11, fontWeight: tab === t.key ? 700 : 400,
            fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.5,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 12px 40px" }}>

        {/* ─── HOME TAB ─── */}
        {tab === "home" && (
          <div>
            {/* Champions Wall */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: gold, marginBottom: 12, textAlign: "center" }}>GREEN JACKET WINNERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {CHAMPIONS.map(c => (
                  <div key={c.year} style={{
                    background: cardBg, borderRadius: 8, padding: "12px 10px",
                    border: `1px solid ${borderColor}`, textAlign: "center",
                    transition: "transform 0.15s", cursor: "default",
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 2 }}>🏆</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: gold }}>{c.year}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 4 }}>{c.golfer}</div>
                    <div style={{ fontSize: 9, color: augustaGreen, marginTop: 2, fontWeight: 600 }}>{c.owner}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 6, fontSize: 9, color: "#6a8a70" }}>
                      <span>Bought: ${c.price}</span>
                      <span>Won: ${Math.round(c.payout)}</span>
                    </div>
                    <div style={{ fontSize: 8, color: "#3a5a40", marginTop: 2 }}>
                      {Math.round(c.payout / c.price)}x return · ${c.pot.toLocaleString()} pot
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pot History */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#5a7a60", marginBottom: 8 }}>POT SIZE HISTORY</div>
              <div style={{ background: cardBg, borderRadius: 8, padding: 14, border: `1px solid ${borderColor}` }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                  {potData.map(p => (
                    <div key={p.year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div style={{ fontSize: 8, color: "#6a8a70", fontWeight: 600 }}>${(p.pot / 1000).toFixed(1)}k</div>
                      <div style={{
                        width: "100%", maxWidth: 40,
                        height: `${(p.pot / maxPot) * 70}px`,
                        background: `linear-gradient(to top, ${augustaGreen}, ${augustaGreen}88)`,
                        borderRadius: "3px 3px 0 0",
                        minHeight: 8,
                      }} />
                      <div style={{ fontSize: 8, color: "#4a6a50", fontWeight: 600 }}>{String(p.year).slice(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fun Stats */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#5a7a60", marginBottom: 8 }}>BY THE NUMBERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 8 }}>
                {funStats.map((s, i) => (
                  <div key={i} style={{
                    background: cardBg, borderRadius: 8, padding: "10px 10px",
                    border: `1px solid ${borderColor}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1, color: "#5a7a60", textTransform: "uppercase" }}>{s.label}</span>
                      <span style={{ fontSize: 14 }}>{s.icon}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.value.startsWith("-") ? "#e63946" : s.value.startsWith("+") ? "#2ecc71" : gold }}>{s.value}</div>
                    <div style={{ fontSize: 8, color: "#5a7a60", marginTop: 2, lineHeight: 1.3 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick All-Time Top 5 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#5a7a60", marginBottom: 8 }}>ALL-TIME NET LEADERS</div>
              <div style={{ background: cardBg, borderRadius: 8, padding: 12, border: `1px solid ${borderColor}` }}>
                {ALL_TIME.slice(0, 5).map((p, i) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 4 ? `1px solid ${borderColor}` : "none" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? gold : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#5a7a60", width: 20, textAlign: "center" }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#e8e6e3", flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: "#5a7a60" }}>{p.years}yr</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.net >= 0 ? "#2ecc71" : "#e63946" }}>{p.net >= 0 ? "+" : ""}${p.net.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button onClick={() => setTab("leaderboard")} style={{
                    background: "transparent", border: `1px solid ${augustaGreen}44`, borderRadius: 4,
                    color: augustaGreen, fontSize: 9, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
                  }}>View full leaderboard →</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── RESULTS TAB ─── */}
        {tab === "results" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: gold, marginBottom: 12, textAlign: "center" }}>YEAR BY YEAR RESULTS</div>
            {TOP_FINISHES.slice().reverse().map(yr => {
              const champ = CHAMPIONS.find(c => c.year === yr.year);
              const isOpen = selectedYear === yr.year;
              const auction = AUCTION_DATA[yr.year] || [];
              return (
                <div key={yr.year} style={{ marginBottom: 8 }}>
                  <div
                    onClick={() => setSelectedYear(isOpen ? null : yr.year)}
                    style={{
                      background: cardBg, borderRadius: isOpen ? "8px 8px 0 0" : 8, padding: "10px 12px",
                      border: `1px solid ${borderColor}`, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 800, color: gold, width: 40 }}>{yr.year}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e6e3" }}>{champ.golfer}</div>
                      <div style={{ fontSize: 9, color: augustaGreen }}>{champ.owner}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#2ecc71" }}>+${Math.round(champ.payout - champ.price)}</div>
                      <div style={{ fontSize: 8, color: "#5a7a60" }}>${champ.pot.toLocaleString()} pot</div>
                    </div>
                    <span style={{ fontSize: 10, color: "#5a7a60", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                  </div>
                  {isOpen && (
                    <div style={{ background: "#0d1a10", borderRadius: "0 0 8px 8px", padding: "8px 12px", border: `1px solid ${borderColor}`, borderTop: "none" }}>
                      {/* Top 5 finishers */}
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#5a7a60", marginBottom: 4 }}>TOP FINISHERS</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 10 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                            <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Finish</th>
                            <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Golfer</th>
                            <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Owner</th>
                            <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Paid</th>
                            <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Won</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yr.results.map((r, i) => {
                            const auc = auction.find(a => a.g === r.golfer || r.golfer.startsWith(a.g));
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${borderColor}22` }}>
                                <td style={{ padding: "5px 4px", fontWeight: 700, color: r.pos === "1st" ? gold : "#e8e6e3", fontSize: r.pos === "1st" ? 11 : 10 }}>
                                  {r.pos === "1st" ? "🏆 " : ""}{r.pos}
                                </td>
                                <td style={{ padding: "5px 4px", color: "#e8e6e3", fontWeight: r.pos === "1st" ? 700 : 400 }}>{r.golfer}</td>
                                <td style={{ padding: "5px 4px", color: augustaGreen, fontSize: 9 }}>{r.owner}</td>
                                <td style={{ padding: "5px 4px", textAlign: "right", color: "#8a9a90", fontSize: 9 }}>{auc ? `$${auc.p}` : "—"}</td>
                                <td style={{ padding: "5px 4px", textAlign: "right", color: "#2ecc71", fontWeight: 600 }}>${r.payout.toFixed(0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Full auction */}
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#5a7a60", marginBottom: 4 }}>FULL AUCTION ({auction.length} lots)</div>
                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                          <tbody>
                            {auction.sort((a, b) => b.p - a.p).map((a, i) => {
                              const isFinisher = yr.results.some(r => r.golfer === a.g || a.g.startsWith(r.golfer.substring(0, 10)));
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${borderColor}11`, background: isFinisher ? `${augustaGreen}10` : "transparent" }}>
                                  <td style={{ padding: "3px 4px", color: "#6a8a70", width: 16, fontSize: 8 }}>{i + 1}</td>
                                  <td style={{ padding: "3px 4px", color: isFinisher ? "#e8e6e3" : "#8a9a90", fontWeight: isFinisher ? 600 : 400 }}>{a.g}</td>
                                  <td style={{ padding: "3px 4px", color: "#5a7a60", fontSize: 8 }}>{a.o}</td>
                                  <td style={{ padding: "3px 4px", textAlign: "right", color: "#8a9a90", fontWeight: 600 }}>${a.p}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 8, color: "#4a6a50", justifyContent: "center" }}>
                        <span>Pot: ${champ.pot.toLocaleString()}</span>
                        <span>Golfers: {champ.field}</span>
                        <span>Payout: 45/25/15/10/5%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── STRATEGIES TAB ─── */}
        {tab === "strategies" && (
          <div>
            {/* Loyalty Plays */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: gold, marginBottom: 4, textAlign: "center" }}>LOYALTY PLAYS</div>
              <div style={{ fontSize: 9, color: "#5a7a60", textAlign: "center", marginBottom: 12 }}>When you find your guy, you stick with him</div>
              {REPEAT_BUYS.map((rb, i) => (
                <div key={i} style={{
                  background: cardBg, borderRadius: 8, padding: "10px 12px", marginBottom: 6,
                  border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: rb.times >= 5 ? `${gold}22` : rb.times >= 4 ? `${augustaGreen}22` : "#1a2a1d",
                    border: `1px solid ${rb.times >= 5 ? gold + "44" : borderColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, color: rb.times >= 5 ? gold : "#6a8a70",
                  }}>{rb.times}x</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e6e3" }}>
                      <span style={{ color: augustaGreen }}>{rb.owner}</span> → {rb.golfer}
                    </div>
                    <div style={{ fontSize: 8, color: "#5a7a60", marginTop: 1 }}>
                      {rb.years.join(", ")} · avg ${rb.avgPrice}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {rb.years.map(y => (
                      <div key={y} style={{ width: 6, height: 6, borderRadius: "50%", background: augustaGreen }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Golfer Price History */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#5a7a60", marginBottom: 8 }}>GOLFER PRICE TRACKER</div>
              <div style={{ fontSize: 9, color: "#4a6a50", marginBottom: 8 }}>Tap a golfer to see their auction price history</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {GOLFER_HISTORIES.map(gh => (
                  <button key={gh.golfer} onClick={() => setSelectedGolfer(selectedGolfer === gh.golfer ? null : gh.golfer)} style={{
                    background: selectedGolfer === gh.golfer ? augustaGreen : "#1a2a1d",
                    border: `1px solid ${selectedGolfer === gh.golfer ? augustaGreen : borderColor}`,
                    borderRadius: 4, padding: "3px 8px", fontSize: 9, cursor: "pointer", fontFamily: "inherit",
                    color: selectedGolfer === gh.golfer ? "#fff" : "#8a9a90",
                  }}>{gh.golfer}</button>
                ))}
              </div>
              {selectedGolfer && (() => {
                const gh = GOLFER_HISTORIES.find(g => g.golfer === selectedGolfer);
                if (!gh) return null;
                const maxP = Math.max(...gh.data.map(d => d.p));
                const allYears = [2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025];
                return (
                  <div style={{ background: cardBg, borderRadius: 8, padding: 14, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e6e3", marginBottom: 8 }}>{gh.golfer}</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, marginBottom: 4 }}>
                      {allYears.map(y => {
                        const entry = gh.data.find(d => d.y === y);
                        return (
                          <div key={y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            {entry ? (
                              <>
                                <div style={{ fontSize: 8, color: "#8a9a90", fontWeight: 600 }}>${entry.p}</div>
                                <div style={{
                                  width: "100%", maxWidth: 28,
                                  height: `${(entry.p / maxP) * 55}px`,
                                  background: `linear-gradient(to top, ${augustaGreen}, ${augustaGreen}88)`,
                                  borderRadius: "2px 2px 0 0", minHeight: 4,
                                }} />
                              </>
                            ) : (
                              <div style={{ width: "100%", maxWidth: 28, height: 1, background: `${borderColor}44` }} />
                            )}
                            <div style={{ fontSize: 7, color: "#4a6a50" }}>'{String(y).slice(2)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 8, color: "#5a7a60", justifyContent: "center", marginTop: 4 }}>
                      <span>Avg: ${Math.round(gh.data.reduce((s, d) => s + d.p, 0) / gh.data.length)}</span>
                      <span>High: ${maxP}</span>
                      <span>Low: ${Math.min(...gh.data.map(d => d.p))}</span>
                      <span>{gh.data.length} auctions</span>
                    </div>
                    {/* Who bought them each year */}
                    <div style={{ marginTop: 8, borderTop: `1px solid ${borderColor}`, paddingTop: 6 }}>
                      {gh.data.map(d => {
                        const auction = AUCTION_DATA[d.y];
                        const entry = auction ? auction.find(a => a.g === gh.golfer || a.g.startsWith(gh.golfer.substring(0, 10))) : null;
                        return (
                          <div key={d.y} style={{ display: "flex", gap: 6, padding: "2px 0", fontSize: 9 }}>
                            <span style={{ color: gold, fontWeight: 700, width: 30 }}>{d.y}</span>
                            <span style={{ color: "#8a9a90", width: 35, textAlign: "right" }}>${d.p}</span>
                            <span style={{ color: augustaGreen, flex: 1 }}>{entry ? entry.o : "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Strategy Archetypes */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#5a7a60", marginBottom: 8 }}>STRATEGY ARCHETYPES</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { name: "The Whale", icon: "🐋", desc: "Drops $500+ in a single auction. Goes big on the favorites and prays.", who: "Peter Berger ($500 in '24), Brian Black ($371 in '18)", color: "#4a9eff" },
                  { name: "The Sniper", icon: "🎯", desc: "Buys cheap mid-tier and hits. Maximum ROI per dollar.", who: "Adam Yeager (2 players in '17, +$360), Kyle Rajotte (Field '23 + '24)", color: "#2ecc71" },
                  { name: "The Loyalist", icon: "🤝", desc: "Same golfer, same owner, every year. Ride or die.", who: "Joe Mangione × Jordan Spieth (6x), Ryan Lee × Brooks Koepka (4x)", color: gold },
                  { name: "The Portfolio", icon: "📊", desc: "Buys 6-10 players and diversifies. Wins by volume.", who: "Joe Curran (10 players in '24, $351 total), Steve Licata", color: "#e67e22" },
                  { name: "The Field General", icon: "🎰", desc: "Buys The Field and hopes for a Cinderella story.", who: "Brian Black ($165 in '17), Kyle Rajotte ($162 in '24), Michael Myers ($200 in '18)", color: "#8e44ad" },
                  { name: "The Contrarian", icon: "🔄", desc: "Bets against the market. Grabs fallen stars at discount.", who: "Joe Curran × Patrick Reed (3x at avg $16), Taylor Smyth × Tiger ('19 at $76)", color: "#e63946" },
                ].map((arch, i) => (
                  <div key={i} style={{
                    background: cardBg, borderRadius: 8, padding: "10px 12px",
                    border: `1px solid ${borderColor}`, borderLeft: `3px solid ${arch.color}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{arch.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: arch.color }}>{arch.name}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#b0c0b0", marginBottom: 4, lineHeight: 1.4 }}>{arch.desc}</div>
                    <div style={{ fontSize: 8, color: "#5a7a60", fontStyle: "italic" }}>{arch.who}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ALL-TIME LEADERBOARD ─── */}
        {tab === "leaderboard" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: gold, marginBottom: 12, textAlign: "center" }}>ALL-TIME STANDINGS</div>
            <div style={{ background: cardBg, borderRadius: 8, border: `1px solid ${borderColor}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 420 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${borderColor}` }}>
                      <th style={{ padding: "8px 6px", textAlign: "left", color: "#5a7a60", fontWeight: 600, fontSize: 8 }}>#</th>
                      <th style={{ padding: "8px 6px", textAlign: "left", color: "#5a7a60", fontWeight: 600, fontSize: 8 }}>Name</th>
                      {[
                        { key: "years", label: "Yrs" },
                        { key: "spent", label: "Spent" },
                        { key: "won", label: "Won" },
                        { key: "net", label: "Net" },
                      ].map(col => {
                        const active = lbSort.key === col.key;
                        return (
                          <th key={col.key} style={{
                            padding: "8px 6px", textAlign: "right", color: active ? "#e8e6e3" : "#5a7a60",
                            fontWeight: 600, fontSize: 8, cursor: "pointer", userSelect: "none",
                          }} onClick={() => setLbSort(prev => prev.key === col.key ? { key: col.key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key: col.key, dir: "desc" })}>
                            {col.label}{active ? (lbSort.dir === "desc" ? " ▾" : " ▴") : ""}
                          </th>
                        );
                      })}
                      <th style={{ padding: "8px 6px", textAlign: "right", color: "#5a7a60", fontWeight: 600, fontSize: 8 }}>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoard.map((p, i) => {
                      const roi = p.spent > 0 ? Math.round((p.won - p.spent) / p.spent * 100) : 0;
                      return (
                        <tr key={p.name} style={{ borderBottom: `1px solid ${borderColor}33`, background: i === 0 && lbSort.key === "net" && lbSort.dir === "desc" ? `${gold}08` : "transparent" }}>
                          <td style={{ padding: "6px 6px", color: "#5a7a60", fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: "6px 6px", color: "#e8e6e3", fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</td>
                          <td style={{ padding: "6px 6px", textAlign: "right", color: "#6a8a70" }}>{p.years}</td>
                          <td style={{ padding: "6px 6px", textAlign: "right", color: "#8a9a90" }}>${p.spent.toLocaleString()}</td>
                          <td style={{ padding: "6px 6px", textAlign: "right", color: p.won > 0 ? "#2ecc71" : "#5a7a60" }}>${p.won.toLocaleString()}</td>
                          <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 700, color: p.net >= 0 ? "#2ecc71" : "#e63946" }}>
                            {p.net >= 0 ? "+" : ""}${p.net.toLocaleString()}
                          </td>
                          <td style={{ padding: "6px 6px", textAlign: "right", color: roi >= 0 ? "#2ecc71" : "#e63946", fontSize: 9 }}>
                            {p.spent > 0 ? `${roi >= 0 ? "+" : ""}${roi}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${borderColor}` }}>
                      <td colSpan={3} style={{ padding: "6px 6px", color: "#5a7a60", fontWeight: 700, fontSize: 9 }}>TOTALS</td>
                      <td style={{ padding: "6px 6px", textAlign: "right", color: "#8a9a90", fontWeight: 600 }}>${ALL_TIME.reduce((s, p) => s + p.spent, 0).toLocaleString()}</td>
                      <td style={{ padding: "6px 6px", textAlign: "right", color: "#2ecc71", fontWeight: 600 }}>${ALL_TIME.reduce((s, p) => s + p.won, 0).toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Owner Championship Count */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#5a7a60", marginBottom: 8 }}>GREEN JACKETS BY OWNER</div>
              <div style={{ background: cardBg, borderRadius: 8, padding: 12, border: `1px solid ${borderColor}` }}>
                {(() => {
                  const counts = {};
                  CHAMPIONS.forEach(c => {
                    const owners = c.owner.split(" / ");
                    owners.forEach(o => { counts[o] = (counts[o] || 0) + 1; });
                  });
                  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count], i) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < Object.keys(counts).length - 1 ? `1px solid ${borderColor}33` : "none" }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: count }).map((_, j) => <span key={j} style={{ fontSize: 14 }}>🧥</span>)}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#e8e6e3", flex: 1 }}>{name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: gold }}>{count}x</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ─── 2026 PREVIEW TAB ─── */}
        {tab === "preview" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: gold, marginBottom: 2 }}>2026 Masters</div>
              <div style={{ fontSize: 11, color: augustaGreen }}>Augusta National Golf Club</div>
              <div style={{ fontSize: 10, color: "#5a7a60" }}>April 9–12, 2026</div>
            </div>

            {/* Rules */}
            <div style={{ background: cardBg, borderRadius: 8, padding: 14, border: `1px solid ${borderColor}`, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#5a7a60", marginBottom: 6 }}>RULES</div>
              <div style={{ fontSize: 9, color: "#8a9a90", lineHeight: 1.5 }}>
                <p style={{ marginBottom: 4 }}>• 42 golfers auctioned individually + The Field (43 total auctions)</p>
                <p style={{ marginBottom: 4 }}>• Payouts: <span style={{ color: gold }}>1st 45%</span> · <span style={{ color: "#c0c0c0" }}>2nd 25%</span> · <span style={{ color: "#cd7f32" }}>3rd 15%</span> · 4th 10% · 5th 5%</p>
                <p style={{ marginBottom: 4 }}>• You can sell/trade players at any time during the tournament</p>
                <p>• Multiple finishers = multiple payouts (stack 'em up)</p>
              </div>
            </div>

            {/* Participants */}
            <div style={{ background: cardBg, borderRadius: 8, padding: 14, border: `1px solid ${borderColor}`, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#5a7a60", marginBottom: 6 }}>PARTICIPANTS ({PARTICIPANTS_2026.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {PARTICIPANTS_2026.map(name => {
                  const allTimeP = ALL_TIME.find(p => p.name === name);
                  const netColor = allTimeP ? (allTimeP.net >= 0 ? "#2ecc71" : "#e63946") : "#5a7a60";
                  return (
                    <div key={name} style={{
                      background: "#0d170f", borderRadius: 4, padding: "3px 8px",
                      border: `1px solid ${borderColor}`, fontSize: 9, color: "#e8e6e3",
                    }}>
                      {name}
                      {allTimeP && <span style={{ color: netColor, marginLeft: 4, fontSize: 8 }}>({allTimeP.net >= 0 ? "+" : ""}{allTimeP.net})</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Golfer List */}
            <div style={{ background: cardBg, borderRadius: 8, padding: 14, border: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#5a7a60", marginBottom: 6 }}>AUCTION BOARD ({GOLFERS_2026.length} lots)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>#</th>
                    <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Golfer</th>
                    <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Odds</th>
                    <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a7a60", fontWeight: 500, fontSize: 8 }}>Masters History</th>
                  </tr>
                </thead>
                <tbody>
                  {GOLFERS_2026.map((g, i) => {
                    const prevWins = CHAMPIONS.filter(c => c.golfer === g.name);
                    const tier = i < 4 ? gold : i < 10 ? "#c0c0c0" : i < 20 ? "#cd7f32" : "#5a7a60";
                    return (
                      <tr key={g.name} style={{ borderBottom: `1px solid ${borderColor}22` }}>
                        <td style={{ padding: "5px 4px", color: "#5a7a60", fontSize: 9 }}>{i + 1}</td>
                        <td style={{ padding: "5px 4px", fontWeight: 600, color: "#e8e6e3" }}>
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: tier, marginRight: 6, verticalAlign: "middle" }} />
                          {g.name}
                          {prevWins.length > 0 && <span style={{ fontSize: 8, color: gold, marginLeft: 4 }}>🏆{prevWins.length > 1 ? `×${prevWins.length}` : ""}</span>}
                        </td>
                        <td style={{ padding: "5px 4px", textAlign: "right", color: augustaGreen, fontWeight: 600, fontSize: 9 }}>{g.odds}</td>
                        <td style={{ padding: "5px 4px", textAlign: "right", fontSize: 8, color: "#5a7a60" }}>
                          {prevWins.length > 0 ? prevWins.map(w => w.year).join(", ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
