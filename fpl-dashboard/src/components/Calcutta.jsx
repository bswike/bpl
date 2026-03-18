import { useState, useMemo } from "react";

// ═══════════════════════════════════════════
// HOGAN CALCUTTA DATA (2023-2025)
// ═══════════════════════════════════════════

const SYNDICATES_2023 = [
  { name: "Bacon", spent: 3650, totalWon: 8948, net: 5298, pct: 1.4515 },
  { name: "Coach", spent: 3330, totalWon: 1092, net: -2238, pct: -0.6721 },
  { name: "Crumbling", spent: 3070, totalWon: 3276, net: 206, pct: 0.0671 },
  { name: "Curran", spent: 4240, totalWon: 7176, net: 2936, pct: 0.6925 },
  { name: "Hogan", spent: 4190, totalWon: 2964, net: -1226, pct: -0.2926 },
  { name: "Hudachek", spent: 3480, totalWon: 2340, net: -1140, pct: -0.3276 },
  { name: "Mustangs", spent: 3370, totalWon: 3276, net: -94, pct: -0.0279 },
  { name: "Smith", spent: 3870, totalWon: 2028, net: -1842, pct: -0.4760 },
];

const SYNDICATES_2024 = [
  { name: "Tomek", spent: 3820, totalWon: 2837, net: -983, pct: -0.2573 },
  { name: "Bacon", spent: 4570, totalWon: 1241, net: -3329, pct: -0.7284 },
  { name: "Coach", spent: 3930, totalWon: 3369, net: -561, pct: -0.1427 },
  { name: "Crumbling", spent: 3560, totalWon: 5322, net: 1762, pct: 0.4949 },
  { name: "Curran", spent: 3360, totalWon: 7630, net: 4270, pct: 1.2708 },
  { name: "Hogan", spent: 1800, totalWon: 885, net: -915, pct: -0.5083 },
  { name: "Hudachek", spent: 5530, totalWon: 9404, net: 3874, pct: 0.7005 },
  { name: "Mustangs", spent: 3970, totalWon: 2827, net: -1143, pct: -0.2879 },
  { name: "Smith", spent: 4950, totalWon: 1951, net: -2999, pct: -0.6059 },
];

const SYNDICATES_2025 = [
  { name: "Tomek", spent: 4430, totalWon: 2652, net: -1778, pct: -0.4014 },
  { name: "Bacon", spent: 4540, totalWon: 6084, net: 1544, pct: 0.3401 },
  { name: "Coach", spent: 3840, totalWon: 1560, net: -2280, pct: -0.5938 },
  { name: "Crumbling", spent: 4450, totalWon: 6084, net: 1634, pct: 0.3672 },
  { name: "Curran", spent: 3180, totalWon: 1716, net: -1464, pct: -0.4604 },
  { name: "Hogan", spent: 4650, totalWon: 5616, net: 966, pct: 0.2077 },
  { name: "Hudachek", spent: 2780, totalWon: 3744, net: 964, pct: 0.3468 },
  { name: "Mustangs", spent: 3340, totalWon: 3744, net: 404, pct: 0.1210 },
];

// Teams by year
const TEAMS_2023 = [
  {s:"Bacon",sd:"14E",t:"Montana State",p:60,w:0,n:-60,seed:14},
  {s:"Bacon",sd:"13MW",t:"Kent State",p:220,w:0,n:-220,seed:13},
  {s:"Bacon",sd:"11E",t:"Providence",p:230,w:0,n:-230,seed:11},
  {s:"Bacon",sd:"10S",t:"Utah State",p:340,w:0,n:-340,seed:10},
  {s:"Bacon",sd:"8E",t:"Memphis",p:380,w:0,n:-380,seed:8},
  {s:"Bacon",sd:"5S",t:"San Diego State",p:620,w:3744,n:3124,seed:5},
  {s:"Bacon",sd:"4E",t:"Tennessee",p:780,w:936,n:156,seed:4},
  {s:"Bacon",sd:"4W",t:"UConn",p:1020,w:4268,n:3248,seed:4},
  {s:"Coach",sd:"7S",t:"Missouri",p:210,w:156,n:-54,seed:7},
  {s:"Coach",sd:"1S",t:"Alabama",p:1720,w:780,n:-940,seed:1},
  {s:"Coach",sd:"2E",t:"Marquette",p:1400,w:156,n:-1244,seed:2},
  {s:"Crumbling",sd:"14W",t:"Grand Canyon",p:40,w:0,n:-40,seed:14},
  {s:"Crumbling",sd:"14S",t:"UC Santa Barbara",p:60,w:0,n:-60,seed:14},
  {s:"Crumbling",sd:"11MW",t:"Pittsburgh",p:190,w:156,n:-34,seed:11},
  {s:"Crumbling",sd:"10MW",t:"Penn State",p:220,w:156,n:-64,seed:10},
  {s:"Crumbling",sd:"9W",t:"Illinois",p:160,w:0,n:-160,seed:9},
  {s:"Crumbling",sd:"8MW",t:"Iowa",p:180,w:0,n:-180,seed:8},
  {s:"Crumbling",sd:"6W",t:"TCU",p:480,w:156,n:-324,seed:6},
  {s:"Crumbling",sd:"5MW",t:"Miami",p:540,w:2808,n:2268,seed:5},
  {s:"Crumbling",sd:"1E",t:"Purdue",p:1200,w:0,n:-1200,seed:1},
  {s:"Curran",sd:"16E",t:"Fairleigh Dickinson",p:45,w:156,n:111,seed:16},
  {s:"Curran",sd:"16W",t:"Howard",p:45,w:0,n:-45,seed:16},
  {s:"Curran",sd:"16MW",t:"N. Kentucky",p:45,w:156,n:111,seed:16},
  {s:"Curran",sd:"16S",t:"TX A&M CC",p:45,w:156,n:111,seed:16},
  {s:"Curran",sd:"12E",t:"Oral Roberts",p:220,w:0,n:-220,seed:12},
  {s:"Curran",sd:"9E",t:"FAU",p:220,w:2808,n:2588,seed:9},
  {s:"Curran",sd:"9S",t:"West Virginia",p:320,w:0,n:-320,seed:9},
  {s:"Curran",sd:"5W",t:"Saint Mary's",p:520,w:156,n:-364,seed:5},
  {s:"Curran",sd:"3W",t:"Gonzaga",p:1200,w:1872,n:672,seed:3},
  {s:"Curran",sd:"2MW",t:"Texas",p:1580,w:1872,n:292,seed:2},
  {s:"Hogan",sd:"14MW",t:"Kennesaw St",p:50,w:0,n:-50,seed:14},
  {s:"Hogan",sd:"12S",t:"Charleston",p:220,w:0,n:-220,seed:12},
  {s:"Hogan",sd:"11W",t:"Arizona St / Nevada",p:170,w:0,n:-170,seed:11},
  {s:"Hogan",sd:"10W",t:"Boise State",p:250,w:0,n:-250,seed:10},
  {s:"Hogan",sd:"6E",t:"Kentucky",p:380,w:156,n:-224,seed:6},
  {s:"Hogan",sd:"6S",t:"Creighton",p:740,w:1872,n:1132,seed:6},
  {s:"Hogan",sd:"3S",t:"Baylor",p:680,w:156,n:-524,seed:3},
  {s:"Hogan",sd:"1MW",t:"Houston",p:1700,w:780,n:-920,seed:1},
  {s:"Hudachek",sd:"9MW",t:"Auburn",p:190,w:156,n:-34,seed:9},
  {s:"Hudachek",sd:"7E",t:"Michigan St",p:250,w:936,n:686,seed:7},
  {s:"Hudachek",sd:"6MW",t:"Iowa State",p:320,w:0,n:-320,seed:6},
  {s:"Hudachek",sd:"4MW",t:"Indiana",p:560,w:156,n:-404,seed:4},
  {s:"Hudachek",sd:"3MW",t:"Xavier",p:860,w:936,n:76,seed:3},
  {s:"Hudachek",sd:"1W",t:"Kansas",p:1300,w:156,n:-1144,seed:1},
  {s:"Mustangs",sd:"15E",t:"Vermont",p:70,w:0,n:-70,seed:15},
  {s:"Mustangs",sd:"15W",t:"UNC Asheville",p:70,w:0,n:-70,seed:15},
  {s:"Mustangs",sd:"13S",t:"Furman",p:180,w:156,n:-24,seed:13},
  {s:"Mustangs",sd:"11S",t:"NC State",p:150,w:0,n:-150,seed:11},
  {s:"Mustangs",sd:"10E",t:"USC",p:230,w:0,n:-230,seed:10},
  {s:"Mustangs",sd:"8W",t:"Arkansas",p:280,w:936,n:656,seed:8},
  {s:"Mustangs",sd:"8S",t:"Maryland",p:160,w:156,n:-4,seed:8},
  {s:"Mustangs",sd:"7W",t:"Northwestern",p:150,w:156,n:6,seed:7},
  {s:"Mustangs",sd:"3E",t:"Kansas State",p:720,w:1872,n:1152,seed:3},
  {s:"Mustangs",sd:"2S",t:"Arizona",p:1360,w:0,n:-1360,seed:2},
  {s:"Smith",sd:"15MW",t:"Colgate",p:70,w:0,n:-70,seed:15},
  {s:"Smith",sd:"15S",t:"Princeton",p:70,w:936,n:866,seed:15},
  {s:"Smith",sd:"13E",t:"Louisiana",p:100,w:0,n:-100,seed:13},
  {s:"Smith",sd:"13W",t:"Iona",p:90,w:0,n:-90,seed:13},
  {s:"Smith",sd:"12W",t:"VCU",p:270,w:0,n:-270,seed:12},
  {s:"Smith",sd:"12MW",t:"Drake",p:240,w:0,n:-240,seed:12},
  {s:"Smith",sd:"7MW",t:"Texas A&M",p:350,w:0,n:-350,seed:7},
  {s:"Smith",sd:"5E",t:"Duke",p:1000,w:156,n:-844,seed:5},
  {s:"Smith",sd:"4S",t:"Virginia",p:480,w:0,n:-480,seed:4},
  {s:"Smith",sd:"2W",t:"UCLA",p:1200,w:936,n:-264,seed:2},
];

const TEAMS_2024 = [
  {s:"Bacon",sd:"14E",t:"Morehead State",p:80,w:0,n:-80,seed:14},
  {s:"Bacon",sd:"11W",t:"New Mexico",p:360,w:0,n:-360,seed:11},
  {s:"Bacon",sd:"10S",t:"Colorado",p:240,w:177,n:-63,seed:10},
  {s:"Bacon",sd:"9MW",t:"TCU",p:220,w:0,n:-220,seed:9},
  {s:"Bacon",sd:"8W",t:"Mississippi St",p:240,w:0,n:-240,seed:8},
  {s:"Bacon",sd:"6S",t:"Texas Tech",p:360,w:0,n:-360,seed:6},
  {s:"Bacon",sd:"6E",t:"BYU",p:420,w:0,n:-420,seed:6},
  {s:"Bacon",sd:"1S",t:"Houston",p:2650,w:1064,n:-1586,seed:1},
  {s:"Coach",sd:"5MW",t:"Gonzaga",p:700,w:1064,n:364,seed:5},
  {s:"Coach",sd:"5S",t:"Wisconsin",p:460,w:0,n:-460,seed:5},
  {s:"Coach",sd:"5E",t:"San Diego State",p:320,w:1064,n:744,seed:5},
  {s:"Coach",sd:"3W",t:"Baylor",p:900,w:177,n:-723,seed:3},
  {s:"Coach",sd:"1W",t:"North Carolina",p:1550,w:1064,n:-486,seed:1},
  {s:"Crumbling",sd:"10E",t:"Drake",p:220,w:0,n:-220,seed:10},
  {s:"Crumbling",sd:"6W",t:"Clemson",p:220,w:2129,n:1909,seed:6},
  {s:"Crumbling",sd:"4S",t:"Duke",p:840,w:2129,n:1289,seed:4},
  {s:"Crumbling",sd:"4E",t:"Auburn",p:980,w:0,n:-980,seed:4},
  {s:"Crumbling",sd:"2E",t:"Iowa State",p:1300,w:1064,n:-236,seed:2},
  {s:"Curran",sd:"14S",t:"Oakland",p:60,w:177,n:117,seed:14},
  {s:"Curran",sd:"11S",t:"NC State",p:200,w:3194,n:2994,seed:11},
  {s:"Curran",sd:"10W",t:"Nevada",p:300,w:0,n:-300,seed:10},
  {s:"Curran",sd:"1MW",t:"Purdue",p:2800,w:4259,n:1459,seed:1},
  {s:"Hogan",sd:"14MW",t:"Akron",p:60,w:0,n:-60,seed:14},
  {s:"Hogan",sd:"13W",t:"Charleston",p:60,w:0,n:-60,seed:13},
  {s:"Hogan",sd:"13S",t:"Vermont",p:80,w:0,n:-80,seed:13},
  {s:"Hogan",sd:"13E",t:"Yale",p:60,w:177,n:117,seed:13},
  {s:"Hogan",sd:"12S",t:"James Madison",p:260,w:177,n:-83,seed:12},
  {s:"Hogan",sd:"9W",t:"Michigan State",p:300,w:177,n:-123,seed:9},
  {s:"Hogan",sd:"7W",t:"Dayton",p:260,w:177,n:-83,seed:7},
  {s:"Hogan",sd:"7E",t:"Washington St",p:220,w:177,n:-43,seed:7},
  {s:"Hogan",sd:"5W",t:"Saint Mary's",p:500,w:0,n:-500,seed:5},
  {s:"Hudachek",sd:"7MW",t:"Texas",p:300,w:177,n:-123,seed:7},
  {s:"Hudachek",sd:"4W",t:"Alabama",p:680,w:3194,n:2514,seed:4},
  {s:"Hudachek",sd:"3MW",t:"Creighton",p:1200,w:1064,n:-136,seed:3},
  {s:"Hudachek",sd:"1E",t:"UConn",p:3350,w:4969,n:1619,seed:1},
  {s:"Mustangs",sd:"14W",t:"Colgate",p:50,w:0,n:-50,seed:14},
  {s:"Mustangs",sd:"12E",t:"UAB",p:200,w:0,n:-200,seed:12},
  {s:"Mustangs",sd:"11MW",t:"Oregon",p:220,w:177,n:-43,seed:11},
  {s:"Mustangs",sd:"11E",t:"Duquesne",p:140,w:177,n:37,seed:11},
  {s:"Mustangs",sd:"9E",t:"Northwestern",p:180,w:177,n:-3,seed:9},
  {s:"Mustangs",sd:"8E",t:"FAU",p:180,w:0,n:-180,seed:8},
  {s:"Mustangs",sd:"7S",t:"Florida",p:400,w:0,n:-400,seed:7},
  {s:"Mustangs",sd:"4MW",t:"Kansas",p:600,w:177,n:-423,seed:4},
  {s:"Mustangs",sd:"2MW",t:"Tennessee",p:2000,w:2119,n:119,seed:2},
  {s:"Smith",sd:"16W",t:"Wagner",p:60,w:0,n:-60,seed:16},
  {s:"Smith",sd:"16MW",t:"Grambling St",p:60,w:0,n:-60,seed:16},
  {s:"Smith",sd:"16S",t:"Longwood",p:60,w:0,n:-60,seed:16},
  {s:"Smith",sd:"16E",t:"Stetson",p:60,w:0,n:-60,seed:16},
  {s:"Smith",sd:"13MW",t:"Samford",p:130,w:0,n:-130,seed:13},
  {s:"Smith",sd:"8S",t:"Nebraska",p:280,w:0,n:-280,seed:8},
  {s:"Smith",sd:"6MW",t:"South Carolina",p:300,w:0,n:-300,seed:6},
  {s:"Smith",sd:"2W",t:"Arizona",p:1850,w:887,n:-963,seed:2},
  {s:"Smith",sd:"2S",t:"Marquette",p:2150,w:1064,n:-1086,seed:2},
  {s:"Tomek",sd:"15W",t:"Long Beach St",p:80,w:177,n:97,seed:15},
  {s:"Tomek",sd:"15MW",t:"Saint Peter's",p:80,w:0,n:-80,seed:15},
  {s:"Tomek",sd:"15S",t:"Western Kentucky",p:75,w:0,n:-75,seed:15},
  {s:"Tomek",sd:"15E",t:"South Dakota St",p:75,w:0,n:-75,seed:15},
  {s:"Tomek",sd:"12W",t:"Grand Canyon",p:210,w:177,n:-33,seed:12},
  {s:"Tomek",sd:"12MW",t:"McNeese State",p:180,w:0,n:-180,seed:12},
  {s:"Tomek",sd:"10MW",t:"Colorado State",p:240,w:0,n:-240,seed:10},
  {s:"Tomek",sd:"9S",t:"Texas A&M",p:250,w:177,n:-73,seed:9},
  {s:"Tomek",sd:"8MW",t:"Utah State",p:180,w:177,n:-3,seed:8},
  {s:"Tomek",sd:"3S",t:"Kentucky",p:1250,w:0,n:-1250,seed:3},
  {s:"Tomek",sd:"3E",t:"Illinois",p:1200,w:2129,n:929,seed:3},
];

const TEAMS_2025 = [
  {s:"Bacon",sd:"14MW",t:"Troy",p:60,w:0,n:-60,seed:14},
  {s:"Bacon",sd:"13W",t:"Grand Canyon",p:70,w:0,n:-70,seed:13},
  {s:"Bacon",sd:"12MW",t:"McNeese State",p:140,w:156,n:16,seed:12},
  {s:"Bacon",sd:"11MW",t:"Xavier",p:240,w:0,n:-240,seed:11},
  {s:"Bacon",sd:"8W",t:"Connecticut",p:180,w:156,n:-24,seed:8},
  {s:"Bacon",sd:"8MW",t:"Gonzaga",p:400,w:156,n:-244,seed:8},
  {s:"Bacon",sd:"7E",t:"Saint Mary's",p:200,w:156,n:-44,seed:7},
  {s:"Bacon",sd:"2MW",t:"Tennessee",p:1350,w:1716,n:366,seed:2},
  {s:"Bacon",sd:"1MW",t:"Houston",p:1900,w:3744,n:1844,seed:1},
  {s:"Coach",sd:"15E",t:"Robert Morris",p:70,w:156,n:86,seed:15},
  {s:"Coach",sd:"15S",t:"Bryant",p:70,w:0,n:-70,seed:15},
  {s:"Coach",sd:"14S",t:"Lipscomb",p:60,w:0,n:-60,seed:14},
  {s:"Coach",sd:"13E",t:"Akron",p:80,w:0,n:-80,seed:13},
  {s:"Coach",sd:"11S",t:"North Carolina",p:200,w:0,n:-200,seed:11},
  {s:"Coach",sd:"10MW",t:"Utah State",p:200,w:0,n:-200,seed:10},
  {s:"Coach",sd:"9S",t:"Creighton",p:160,w:156,n:-4,seed:9},
  {s:"Coach",sd:"5S",t:"Michigan",p:550,w:936,n:386,seed:5},
  {s:"Coach",sd:"3E",t:"Wisconsin",p:750,w:156,n:-594,seed:3},
  {s:"Coach",sd:"2W",t:"St. John's",p:1700,w:156,n:-1544,seed:2},
  {s:"Crumbling",sd:"12E",t:"Liberty",p:160,w:0,n:-160,seed:12},
  {s:"Crumbling",sd:"7S",t:"Marquette",p:240,w:0,n:-240,seed:7},
  {s:"Crumbling",sd:"4MW",t:"Purdue",p:550,w:936,n:386,seed:4},
  {s:"Crumbling",sd:"3MW",t:"Kentucky",p:700,w:936,n:236,seed:3},
  {s:"Crumbling",sd:"1W",t:"Florida",p:2800,w:4212,n:1412,seed:1},
  {s:"Curran",sd:"15W",t:"Omaha",p:70,w:0,n:-70,seed:15},
  {s:"Curran",sd:"15MW",t:"Wofford",p:70,w:156,n:86,seed:15},
  {s:"Curran",sd:"12W",t:"Colorado State",p:200,w:156,n:-44,seed:12},
  {s:"Curran",sd:"9W",t:"Oklahoma",p:160,w:0,n:-160,seed:9},
  {s:"Curran",sd:"9E",t:"Baylor",p:180,w:156,n:-24,seed:9},
  {s:"Curran",sd:"7W",t:"Kansas",p:380,w:0,n:-380,seed:7},
  {s:"Curran",sd:"6W",t:"Missouri",p:320,w:0,n:-320,seed:6},
  {s:"Curran",sd:"6MW",t:"Illinois",p:400,w:156,n:-244,seed:6},
  {s:"Curran",sd:"4W",t:"Maryland",p:850,w:936,n:86,seed:4},
  {s:"Curran",sd:"4S",t:"Texas A&M",p:550,w:156,n:-394,seed:4},
  {s:"Hogan",sd:"13S",t:"Yale",p:140,w:0,n:-140,seed:13},
  {s:"Hogan",sd:"11E",t:"VCU",p:300,w:0,n:-300,seed:11},
  {s:"Hogan",sd:"9MW",t:"Georgia",p:140,w:0,n:-140,seed:9},
  {s:"Hogan",sd:"7MW",t:"UCLA",p:320,w:156,n:-164,seed:7},
  {s:"Hogan",sd:"4E",t:"Arizona",p:650,w:936,n:286,seed:4},
  {s:"Hogan",sd:"3W",t:"Texas Tech",p:1400,w:1872,n:472,seed:3},
  {s:"Hogan",sd:"1S",t:"Auburn",p:1700,w:2652,n:952,seed:1},
  {s:"Hudachek",sd:"12S",t:"UC San Diego",p:260,w:0,n:-260,seed:12},
  {s:"Hudachek",sd:"6E",t:"BYU",p:420,w:936,n:516,seed:6},
  {s:"Hudachek",sd:"1E",t:"Duke",p:2100,w:2808,n:708,seed:1},
  {s:"Mustangs",sd:"14W",t:"UNC Wilmington",p:80,w:0,n:-80,seed:14},
  {s:"Mustangs",sd:"13MW",t:"High Point",p:100,w:0,n:-100,seed:13},
  {s:"Mustangs",sd:"10W",t:"Arkansas",p:200,w:936,n:736,seed:10},
  {s:"Mustangs",sd:"10E",t:"Vanderbilt",p:140,w:0,n:-140,seed:10},
  {s:"Mustangs",sd:"8E",t:"Mississippi St",p:180,w:0,n:-180,seed:8},
  {s:"Mustangs",sd:"8S",t:"Louisville",p:300,w:0,n:-300,seed:8},
  {s:"Mustangs",sd:"6S",t:"Ole Miss",p:500,w:936,n:436,seed:6},
  {s:"Mustangs",sd:"5W",t:"Memphis",p:240,w:0,n:-240,seed:5},
  {s:"Mustangs",sd:"2S",t:"Michigan State",p:1600,w:1872,n:272,seed:2},
  {s:"Tomek",sd:"16W",t:"Norfolk State",p:50,w:156,n:106,seed:16},
  {s:"Tomek",sd:"16MW",t:"SIU Edwardsville",p:50,w:0,n:-50,seed:16},
  {s:"Tomek",sd:"16E",t:"Mount St. Mary's",p:50,w:0,n:-50,seed:16},
  {s:"Tomek",sd:"16S",t:"Alabama State",p:50,w:156,n:106,seed:16},
  {s:"Tomek",sd:"14E",t:"Montana",p:80,w:0,n:-80,seed:14},
  {s:"Tomek",sd:"11W",t:"Drake",p:180,w:156,n:-24,seed:11},
  {s:"Tomek",sd:"10S",t:"New Mexico",p:220,w:156,n:-64,seed:10},
  {s:"Tomek",sd:"5MW",t:"Clemson",p:650,w:0,n:-650,seed:5},
  {s:"Tomek",sd:"5E",t:"Oregon",p:600,w:156,n:-444,seed:5},
  {s:"Tomek",sd:"3S",t:"Iowa State",p:1150,w:156,n:-994,seed:3},
  {s:"Tomek",sd:"2E",t:"Alabama",p:1350,w:1716,n:366,seed:2},
];

const ALL_TEAMS = [
  ...TEAMS_2023.map(t => ({...t, year: 2023})),
  ...TEAMS_2024.map(t => ({...t, year: 2024})),
  ...TEAMS_2025.map(t => ({...t, year: 2025})),
];

// Colors
const SYNDICATE_COLORS = {
  Bacon: "#e63946",
  Coach: "#457b9d",
  Crumbling: "#2a9d8f",
  Curran: "#e9c46a",
  Hogan: "#f4a261",
  Hudachek: "#6a4c93",
  Mustangs: "#1d3557",
  Smith: "#264653",
  Tomek: "#d62828",
};

const fmt = (n) => {
  if (n === undefined || n === null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.round(n).toLocaleString()}`;
};
const fmtPct = (n) => {
  if (n === undefined || n === null) return "—";
  const pct = (n * 100).toFixed(1);
  return n > 0 ? `+${pct}%` : `${pct}%`;
};
const fmtDollar = (n) => `$${Math.round(n).toLocaleString()}`;

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════

const BRACKET_2026 = [
  // South - s16 = Sweet 16 odds (implied probability from BetMGM/DK)
  {r:"S",s:16,t:"PV A&M/Lehigh",odds:"+20000",s16:"<1%",note:"First Four"},
  {r:"S",s:15,t:"Idaho +23.5",odds:"+20000",s16:"2%",note:"Paired w/ Furman"},
  {r:"S",s:14,t:"Penn",odds:"+20000",s16:"2%",note:""},
  {r:"S",s:13,t:"Troy",odds:"+20000",s16:"5%",note:""},
  {r:"S",s:12,t:"McNeese",odds:"+20000",s16:"13%",note:"Back from '25"},
  {r:"S",s:11,t:"VCU",odds:"+10000",s16:"25%",note:"16 of last 17 W, UNC hurt"},
  {r:"S",s:10,t:"Texas A&M",odds:"+20000",s16:"18%",note:""},
  {r:"S",s:9,t:"Iowa",odds:"+10000",s16:"30%",note:"Underseeded per KenPom"},
  {r:"S",s:8,t:"Clemson",odds:"+10000",s16:"22%",note:""},
  {r:"S",s:7,t:"Saint Mary's",odds:"+10000",s16:"28%",note:""},
  {r:"S",s:6,t:"North Carolina",odds:"+6000",s16:"25%",note:"Wilson out (broken thumb)"},
  {r:"S",s:5,t:"Vanderbilt",odds:"+5000",s16:"55%",note:"Expert sleeper, beat UF by 17"},
  {r:"S",s:4,t:"Nebraska",odds:"+5000",s16:"52%",note:"Cheapest 4-seed"},
  {r:"S",s:3,t:"Illinois",odds:"+1900",s16:"68%",note:"Young, explosive O"},
  {r:"S",s:2,t:"Houston",odds:"+1000",s16:"82%",note:"Lost title game '25, elite D"},
  {r:"S",s:1,t:"Florida",odds:"+700",s16:"88%",note:"Defending champ"},
  // Midwest
  {r:"MW",s:16,t:"Howard",odds:"+20000",s16:"<1%",note:"Won First Four"},
  {r:"MW",s:15,t:"TN State +24.5",odds:"+20000",s16:"2%",note:"Paired w/ Queens"},
  {r:"MW",s:14,t:"Wright State",odds:"+20000",s16:"2%",note:""},
  {r:"MW",s:13,t:"Hofstra",odds:"+20000",s16:"5%",note:""},
  {r:"MW",s:12,t:"Akron",odds:"+20000",s16:"10%",note:""},
  {r:"MW",s:11,t:"SMU/Miami OH",odds:"+20000",s16:"15%",note:"First Four Wed"},
  {r:"MW",s:10,t:"Santa Clara",odds:"+20000",s16:"20%",note:""},
  {r:"MW",s:9,t:"Saint Louis",odds:"+10000",s16:"32%",note:"A10 champ, top-15 O & D"},
  {r:"MW",s:8,t:"Georgia",odds:"+10000",s16:"18%",note:"315th pts allowed"},
  {r:"MW",s:7,t:"Kentucky",odds:"+5000",s16:"30%",note:""},
  {r:"MW",s:6,t:"Tennessee",odds:"+4000",s16:"38%",note:"Lost 4 of last 6"},
  {r:"MW",s:5,t:"Texas Tech",odds:"+4000",s16:"52%",note:""},
  {r:"MW",s:4,t:"Alabama",odds:"+4000",s16:"55%",note:"Cinderella candidate"},
  {r:"MW",s:3,t:"Virginia",odds:"+3000",s16:"60%",note:""},
  {r:"MW",s:2,t:"Iowa State",odds:"+1800",s16:"78%",note:"KenPom #4 defense"},
  {r:"MW",s:1,t:"Michigan",odds:"+350",s16:"92%",note:"31-3, #1 KenPom"},
  // West
  {r:"W",s:16,t:"LIU +31.5",odds:"+20000",s16:"<1%",note:""},
  {r:"W",s:15,t:"Queens +25.5",odds:"+20000",s16:"2%",note:"Paired w/ TN St"},
  {r:"W",s:14,t:"Kennesaw State",odds:"+20000",s16:"2%",note:""},
  {r:"W",s:13,t:"Hawaii",odds:"+20000",s16:"8%",note:"Unique no-help D"},
  {r:"W",s:12,t:"High Point",odds:"+20000",s16:"10%",note:"Uptempo, 90 PPG"},
  {r:"W",s:11,t:"Texas",odds:"+10000",s16:"18%",note:"Won First Four"},
  {r:"W",s:10,t:"Missouri",odds:"+20000",s16:"22%",note:""},
  {r:"W",s:9,t:"Utah State",odds:"+10000",s16:"25%",note:"MWC champ"},
  {r:"W",s:8,t:"Villanova",odds:"+10000",s16:"28%",note:"Back in tourney"},
  {r:"W",s:7,t:"Miami FL",odds:"+10000",s16:"28%",note:""},
  {r:"W",s:6,t:"BYU",odds:"+5000",s16:"40%",note:"Dybantsa top-5 pick"},
  {r:"W",s:5,t:"Wisconsin",odds:"+5000",s16:"50%",note:"Shoots 3s now"},
  {r:"W",s:4,t:"Arkansas",odds:"+3000",s16:"55%",note:"Calipari curse as high seed"},
  {r:"W",s:3,t:"Gonzaga",odds:"+2500",s16:"65%",note:"Top-3 seed first time since '23"},
  {r:"W",s:2,t:"Purdue",odds:"+3500",s16:"75%",note:"B10 champ, broke assist record"},
  {r:"W",s:1,t:"Arizona",odds:"+400",s16:"92%",note:"32-2, healthiest 1 seed"},
  // East
  {r:"E",s:16,t:"Siena +28.5",odds:"+20000",s16:"<1%",note:""},
  {r:"E",s:15,t:"Furman +20.5",odds:"+20000",s16:"2%",note:"Paired w/ Idaho"},
  {r:"E",s:14,t:"N Dakota State",odds:"+20000",s16:"2%",note:""},
  {r:"E",s:13,t:"Cal Baptist",odds:"+20000",s16:"5%",note:""},
  {r:"E",s:12,t:"Northern Iowa",odds:"+20000",s16:"12%",note:""},
  {r:"E",s:11,t:"South Florida",odds:"+10000",s16:"20%",note:"CBS sleeper"},
  {r:"E",s:10,t:"UCF",odds:"+20000",s16:"18%",note:""},
  {r:"E",s:9,t:"TCU",odds:"+10000",s16:"22%",note:""},
  {r:"E",s:8,t:"Ohio State",odds:"+10000",s16:"25%",note:""},
  {r:"E",s:7,t:"UCLA",odds:"+5000",s16:"35%",note:""},
  {r:"E",s:6,t:"Louisville",odds:"+5000",s16:"32%",note:"3-6 vs Top 25, Brown out"},
  {r:"E",s:5,t:"St. John's",odds:"+5000",s16:"55%",note:"BE champ, underseeded per Nate Silver"},
  {r:"E",s:4,t:"Kansas",odds:"+4000",s16:"58%",note:"Peterson = potential #1 pick"},
  {r:"E",s:3,t:"Michigan State",odds:"+4000",s16:"55%",note:""},
  {r:"E",s:2,t:"UConn",odds:"+1700",s16:"78%",note:"2x champ Hurley, Karaban back"},
  {r:"E",s:1,t:"Duke",odds:"+300",s16:"90%",note:"32-2, #1 overall, Foster ?"},
];

const HIST_AVG_PRICE = {16:48,15:72,14:65,13:108,12:200,11:220,10:225,9:200,8:250,7:290,6:420,5:550,4:680,3:950,2:1550,1:2100};
const HIST_ROI = {16:0.17,15:0.32,14:-0.81,13:-0.77,12:-0.59,11:0.19,10:-0.48,9:0.30,8:-0.39,7:-0.30,6:0.09,5:0.18,4:-0.08,3:0.02,2:-0.15,1:0.20};


const MAIN_TABS = ["2026 Prep", "Teams", "Seed ROI"];
const EXTRA_TABS = ["Leaderboard", "Strategy"];

export default function App() {
  const [activeTab, setActiveTab] = useState("2026 Prep");
  const [selectedYear, setSelectedYear] = useState("All");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0e17 0%, #121a2b 50%, #0d1321 100%)",
      color: "#e8e6e3",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      padding: "20px",
      boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
        <div style={{
          fontSize: 11,
          letterSpacing: 6,
          color: "#4a9eff",
          textTransform: "uppercase",
          marginBottom: 6,
          fontWeight: 600,
        }}>March Madness Calcutta</div>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "clamp(24px, 5vw, 38px)",
          fontWeight: 700,
          margin: 0,
          background: "linear-gradient(135deg, #4a9eff, #7c5cfc, #e63946)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: -1,
        }}>HOGAN CALCUTTA</h1>
        <div style={{
          fontSize: 12,
          color: "#5a6a8a",
          marginTop: 4,
          letterSpacing: 2,
        }}>2023 — 2024 — 2025</div>
      </div>

      {/* Main tabs */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        marginBottom: 10,
        flexWrap: "wrap",
      }}>
        {MAIN_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 22px",
              background: activeTab === tab
                ? "linear-gradient(135deg, #4a9eff22, #7c5cfc22)"
                : "transparent",
              border: `1px solid ${activeTab === tab ? "#4a9eff" : "#1e2a40"}`,
              borderRadius: 6,
              color: activeTab === tab ? "#4a9eff" : "#8a9aba",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 500,
              cursor: "pointer",
              letterSpacing: 1,
              transition: "all 0.2s",
            }}
          >{tab}</button>
        ))}
      </div>

      {/* Secondary tabs — smaller, muted */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        marginBottom: 20,
      }}>
        {EXTRA_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 10px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "1px solid #4a9eff" : "1px solid transparent",
              color: activeTab === tab ? "#4a9eff" : "#3a4a6a",
              fontFamily: "inherit",
              fontSize: 10,
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: "pointer",
              letterSpacing: 1,
              transition: "all 0.2s",
            }}
          >{tab}</button>
        ))}
      </div>

      {/* Year filter - only show for historical tabs */}
      {activeTab !== "2026 Prep" && (
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 4,
        marginBottom: 24,
      }}>
        {["All", "2023", "2024", "2025"].map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            style={{
              padding: "5px 14px",
              background: selectedYear === y ? "#4a9eff" : "transparent",
              border: `1px solid ${selectedYear === y ? "#4a9eff" : "#1e2a40"}`,
              borderRadius: 4,
              color: selectedYear === y ? "#0a0e17" : "#5a6a8a",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: selectedYear === y ? 700 : 400,
              cursor: "pointer",
            }}
          >{y}</button>
        ))}
      </div>
      )}

      {activeTab === "2026 Prep" && <AuctionPrep />}
      {activeTab === "Leaderboard" && <Leaderboard year={selectedYear} />}
      {activeTab === "Seed ROI" && <SeedROI year={selectedYear} />}
      {activeTab === "Strategy" && <Strategy year={selectedYear} />}
      {activeTab === "Teams" && <TeamExplorer year={selectedYear} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════

function Leaderboard({ year }) {
  const data = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    const allSyns = { 2023: SYNDICATES_2023, 2024: SYNDICATES_2024, 2025: SYNDICATES_2025 };

    const agg = {};
    years.forEach(y => {
      allSyns[y].forEach(s => {
        if (!agg[s.name]) agg[s.name] = { name: s.name, totalSpent: 0, totalWon: 0, totalNet: 0, years: 0, records: [] };
        agg[s.name].totalSpent += s.spent;
        agg[s.name].totalWon += s.totalWon;
        agg[s.name].totalNet += s.net;
        agg[s.name].years += 1;
        agg[s.name].records.push({ year: y, ...s });
      });
    });
    return Object.values(agg).sort((a, b) => b.totalNet - a.totalNet);
  }, [year]);

  const maxNet = Math.max(...data.map(d => Math.abs(d.totalNet)), 1);

  return (
    <div>
      <SectionTitle>Syndicate Leaderboard</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2a40" }}>
              {["#", "Syndicate", "Spent", "Won", "Net P/L", "ROI", ""].map((h,i) => (
                <th key={i} style={{
                  padding: "8px 10px",
                  textAlign: i >= 2 ? "right" : "left",
                  color: "#4a6a8a",
                  fontWeight: 500,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const barW = Math.abs(d.totalNet) / maxNet * 100;
              const isPos = d.totalNet >= 0;
              return (
                <tr key={d.name} style={{
                  borderBottom: "1px solid #111827",
                  background: i === 0 ? "linear-gradient(90deg, #4a9eff08, transparent)" : "transparent",
                }}>
                  <td style={{ padding: "10px", color: "#4a6a8a", fontWeight: 600, width: 30 }}>{i + 1}</td>
                  <td style={{ padding: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: SYNDICATE_COLORS[d.name] || "#555",
                      }} />
                      <span style={{ fontWeight: 600, color: i === 0 ? "#4a9eff" : "#e8e6e3" }}>{d.name}</span>
                      {year === "All" && <span style={{ fontSize: 10, color: "#4a6a8a" }}>({d.years}yr)</span>}
                    </div>
                  </td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#7a8aaa" }}>{fmtDollar(d.totalSpent)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#7a8aaa" }}>{fmtDollar(d.totalWon)}</td>
                  <td style={{
                    padding: "10px", textAlign: "right", fontWeight: 700,
                    color: isPos ? "#2ecc71" : "#e63946",
                  }}>{fmt(d.totalNet)}</td>
                  <td style={{
                    padding: "10px", textAlign: "right", fontWeight: 500,
                    color: isPos ? "#2ecc71" : "#e63946",
                  }}>{fmtPct(d.totalNet / d.totalSpent)}</td>
                  <td style={{ padding: "10px 10px 10px 6px", width: "20%" }}>
                    <div style={{
                      height: 8, borderRadius: 4,
                      background: "#111827",
                      overflow: "hidden",
                      position: "relative",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${barW}%`,
                        borderRadius: 4,
                        background: isPos
                          ? "linear-gradient(90deg, #2ecc71, #27ae60)"
                          : "linear-gradient(90deg, #e63946, #c0392b)",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Year-over-year sparklines */}
      {year === "All" && (
        <div style={{ marginTop: 28 }}>
          <SubTitle>Year-over-Year Net P/L</SubTitle>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 10,
          }}>
            {data.map(d => (
              <div key={d.name} style={{
                background: "#111827",
                borderRadius: 8,
                padding: "12px 14px",
                border: "1px solid #1e2a40",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: SYNDICATE_COLORS[d.name] || "#555",
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{d.name}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 48 }}>
                  {[2023, 2024, 2025].map(y => {
                    const rec = d.records.find(r => r.year === y);
                    if (!rec) return (
                      <div key={y} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "#3a4a6a" }}>—</div>
                        <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 2 }}>{y}</div>
                      </div>
                    );
                    const h = Math.min(Math.abs(rec.net) / 5000 * 36, 36);
                    return (
                      <div key={y} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{
                          height: h,
                          background: rec.net >= 0
                            ? "linear-gradient(180deg, #2ecc71, #27ae6088)"
                            : "linear-gradient(180deg, #e63946, #c0392b88)",
                          borderRadius: 3,
                          margin: "0 auto",
                          width: "60%",
                          minHeight: 4,
                        }} />
                        <div style={{
                          fontSize: 9,
                          color: rec.net >= 0 ? "#2ecc71" : "#e63946",
                          marginTop: 3,
                          fontWeight: 600,
                        }}>{fmt(rec.net)}</div>
                        <div style={{ fontSize: 8, color: "#3a4a6a", marginTop: 1 }}>{y}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SEED ROI
// ═══════════════════════════════════════════

function SeedROI({ year }) {
  const data = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    const filtered = ALL_TEAMS.filter(t => years.includes(t.year));

    const seedMap = {};
    filtered.forEach(t => {
      const s = t.seed;
      if (!seedMap[s]) {
        seedMap[s] = { seed: s, count: 0, totalSpent: 0, totalWon: 0, totalNet: 0, winners: 0, s16: 0 };
      }
      seedMap[s].count++;
      seedMap[s].totalSpent += t.p;
      seedMap[s].totalWon += t.w;
      seedMap[s].totalNet += t.n;
      if (t.n > 0) seedMap[s].winners++;
      // Sweet 16 = won at least 2 games = winnings >= $700 (R1 ~$156-200, R2 adds ~$600+)
      if (t.w >= 700) seedMap[s].s16++;
    });
    
    return Object.values(seedMap).sort((a, b) => a.seed - b.seed);
  }, [year]);

  const maxAbsNet = Math.max(...data.map(d => Math.abs(d.totalNet)), 1);

  // Price tier analysis
  const priceData = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    const filtered = ALL_TEAMS.filter(t => years.includes(t.year));
    const tiers = [
      { label: "Bargain ($0-100)", min: 0, max: 100 },
      { label: "Value ($101-300)", min: 101, max: 300 },
      { label: "Mid ($301-700)", min: 301, max: 700 },
      { label: "Premium ($701-1500)", min: 701, max: 1500 },
      { label: "Elite ($1500+)", min: 1500, max: 99999 },
    ];
    return tiers.map(tier => {
      const teams = filtered.filter(t => t.p >= tier.min && t.p <= tier.max);
      const totalSpent = teams.reduce((a, t) => a + t.p, 0);
      const totalNet = teams.reduce((a, t) => a + t.n, 0);
      const winners = teams.filter(t => t.n > 0).length;
      return { ...tier, count: teams.length, totalSpent, totalNet, roi: totalSpent ? totalNet / totalSpent : 0, hitRate: teams.length ? winners / teams.length : 0 };
    });
  }, [year]);

  return (
    <div>
      <SectionTitle>ROI by Seed</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2a40" }}>
              {["Seed", "Avg $", "Net", "S16 %", "Hit %", ""].map((h,i) => (
                <th key={i} style={{
                  padding: "8px 8px",
                  textAlign: i >= 1 ? "right" : "left",
                  color: "#4a6a8a",
                  fontWeight: 500,
                  fontSize: 9,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(d => {
              const barW = Math.abs(d.totalNet) / maxAbsNet * 100;
              const isPos = d.totalNet >= 0;
              return (
                <tr key={d.seed} style={{ borderBottom: "1px solid #111827" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>
                    <span style={{
                      display: "inline-block",
                      width: 28, height: 28,
                      lineHeight: "28px",
                      textAlign: "center",
                      borderRadius: 6,
                      background: d.seed <= 4 ? "#4a9eff15" : d.seed <= 8 ? "#7c5cfc10" : "#1a1f2e",
                      color: d.seed <= 4 ? "#4a9eff" : d.seed <= 8 ? "#7c5cfc" : "#6a7a9a",
                      fontSize: 11,
                    }}>{d.seed}</span>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#7a8aaa", fontSize: 11 }}>{fmtDollar(d.totalSpent / d.count)}</td>
                  <td style={{
                    padding: "8px 8px", textAlign: "right", fontWeight: 600, fontSize: 11,
                    color: isPos ? "#2ecc71" : "#e63946",
                  }}>{fmt(d.totalNet)}</td>
                  <td style={{
                    padding: "8px 8px", textAlign: "right", fontWeight: 700, fontSize: 11,
                    color: d.s16 / d.count >= 0.5 ? "#2ecc71" : d.s16 / d.count >= 0.25 ? "#e9c46a" : "#e63946",
                  }}>{d.count ? `${Math.round(d.s16 / d.count * 100)}%` : "—"}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#7a8aaa", fontSize: 11 }}>
                    {d.count ? `${Math.round(d.winners / d.count * 100)}%` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", width: "18%" }}>
                    <div style={{
                      height: 8, borderRadius: 4,
                      background: "#111827",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${barW}%`,
                        borderRadius: 4,
                        background: isPos
                          ? "linear-gradient(90deg, #2ecc71, #27ae60)"
                          : "linear-gradient(90deg, #e63946, #c0392b)",
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Price Tier Analysis */}
      <div style={{ marginTop: 28 }}>
        <SubTitle>ROI by Price Tier</SubTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
        }}>
          {priceData.map(tier => (
            <div key={tier.label} style={{
              background: "#111827",
              borderRadius: 8,
              padding: 14,
              border: "1px solid #1e2a40",
            }}>
              <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                {tier.label}
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: tier.roi >= 0 ? "#2ecc71" : "#e63946",
                fontFamily: "'Space Grotesk', sans-serif",
              }}>{fmtPct(tier.roi)}</div>
              <div style={{ fontSize: 10, color: "#5a6a8a", marginTop: 4 }}>
                {tier.count} teams · {Math.round(tier.hitRate * 100)}% hit rate
              </div>
              <div style={{
                fontSize: 11,
                color: tier.totalNet >= 0 ? "#2ecc7188" : "#e6394688",
                marginTop: 2,
                fontWeight: 600,
              }}>{fmt(tier.totalNet)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// STRATEGY
// ═══════════════════════════════════════════

function Strategy({ year }) {
  const spendData = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    const allSyns = { 2023: SYNDICATES_2023, 2024: SYNDICATES_2024, 2025: SYNDICATES_2025 };

    const entries = [];
    years.forEach(y => {
      allSyns[y].forEach(s => {
        entries.push({ year: y, name: s.name, spent: s.spent, net: s.net, roi: s.net / s.spent });
      });
    });
    return entries;
  }, [year]);

  // Concentration analysis
  const concData = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    const allTeamSets = { 2023: TEAMS_2023, 2024: TEAMS_2024, 2025: TEAMS_2025 };

    const agg = {};
    years.forEach(y => {
      const teams = allTeamSets[y];
      const synGroups = {};
      teams.forEach(t => {
        if (!synGroups[t.s]) synGroups[t.s] = [];
        synGroups[t.s].push(t);
      });
      Object.entries(synGroups).forEach(([name, ts]) => {
        const totalSpent = ts.reduce((a, t) => a + t.p, 0);
        const topTeam = ts.reduce((a, t) => t.p > a.p ? t : a, ts[0]);
        const concentration = topTeam.p / totalSpent;
        const numTeams = ts.length;
        const totalNet = ts.reduce((a, t) => a + t.n, 0);

        if (!agg[name]) agg[name] = { name, entries: [] };
        agg[name].entries.push({ year: y, concentration, numTeams, topTeam: topTeam.t, topPrice: topTeam.p, totalSpent, totalNet });
      });
    });
    return Object.values(agg);
  }, [year]);

  // Best single picks ever
  const bestPicks = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    return ALL_TEAMS
      .filter(t => years.includes(t.year))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [year]);

  const worstPicks = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    return ALL_TEAMS
      .filter(t => years.includes(t.year))
      .sort((a, b) => a.n - b.n)
      .slice(0, 10);
  }, [year]);

  return (
    <div>
      <SectionTitle>Auction Strategy Breakdown</SectionTitle>

      {/* Spend vs ROI scatter plot (text-based) */}
      <SubTitle>Spend vs. Outcome</SubTitle>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 24,
      }}>
        <div style={{
          background: "#111827",
          borderRadius: 8,
          padding: 14,
          border: "1px solid #1e2a40",
        }}>
          <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            Winners (Positive ROI)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1 }}>SYNDICATE</span>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1, minWidth: 65, textAlign: "right" }}>SPENT</span>
              <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1, minWidth: 70, textAlign: "right" }}>NET P/L</span>
              <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1, minWidth: 50, textAlign: "right" }}>ROI</span>
            </div>
          </div>
          {spendData.filter(d => d.net > 0).sort((a, b) => b.roi - a.roi).map((d, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              padding: "4px 0",
              borderBottom: "1px solid #111d2e",
              fontSize: 11,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: SYNDICATE_COLORS[d.name] || "#555",
                }} />
                <span>{d.name}</span>
                {year === "All" && <span style={{ color: "#3a4a6a", fontSize: 9 }}>'{String(d.year).slice(2)}</span>}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#5a6a8a", minWidth: 65, textAlign: "right" }}>{fmtDollar(d.spent)}</span>
                <span style={{ color: "#2ecc71", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmt(d.net)}</span>
                <span style={{ color: "#2ecc71", fontWeight: 600, minWidth: 50, textAlign: "right" }}>{fmtPct(d.roi)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          background: "#111827",
          borderRadius: 8,
          padding: 14,
          border: "1px solid #1e2a40",
        }}>
          <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            Losers (Negative ROI)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1 }}>SYNDICATE</span>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1, minWidth: 65, textAlign: "right" }}>SPENT</span>
              <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1, minWidth: 70, textAlign: "right" }}>NET P/L</span>
              <span style={{ fontSize: 9, color: "#3a4a6a", letterSpacing: 1, minWidth: 50, textAlign: "right" }}>ROI</span>
            </div>
          </div>
          {spendData.filter(d => d.net < 0).sort((a, b) => a.roi - b.roi).map((d, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              padding: "4px 0",
              borderBottom: "1px solid #111d2e",
              fontSize: 11,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: SYNDICATE_COLORS[d.name] || "#555",
                }} />
                <span>{d.name}</span>
                {year === "All" && <span style={{ color: "#3a4a6a", fontSize: 9 }}>'{String(d.year).slice(2)}</span>}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#5a6a8a", minWidth: 65, textAlign: "right" }}>{fmtDollar(d.spent)}</span>
                <span style={{ color: "#e63946", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmt(d.net)}</span>
                <span style={{ color: "#e63946", fontWeight: 600, minWidth: 50, textAlign: "right" }}>{fmtPct(d.roi)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio concentration */}
      <SubTitle>Portfolio Concentration</SubTitle>
      <div style={{ fontSize: 10, color: "#4a6a8a", marginBottom: 10 }}>
        % of budget on most expensive team — does going "all-in" pay off?
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2a40" }}>
              {["Syndicate", "Year", "Top Pick", "Conc %", "# Teams", "Result"].map((h,i) => (
                <th key={i} style={{
                  padding: "6px 8px",
                  textAlign: i >= 3 ? "right" : "left",
                  color: "#4a6a8a",
                  fontWeight: 500,
                  fontSize: 9,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concData.flatMap(d => d.entries.map((e, i) => (
              <tr key={`${d.name}-${e.year}`} style={{ borderBottom: "1px solid #111827" }}>
                <td style={{ padding: "6px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: 1,
                      background: SYNDICATE_COLORS[d.name] || "#555",
                    }} />
                    {d.name}
                  </div>
                </td>
                <td style={{ padding: "6px 8px", color: "#5a6a8a" }}>{e.year}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{ color: "#8a9aba" }}>{e.topTeam}</span>
                  <span style={{ color: "#3a4a6a", marginLeft: 6, fontSize: 10 }}>{fmtDollar(e.topPrice)}</span>
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>
                  {Math.round(e.concentration * 100)}%
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "#5a6a8a" }}>{e.numTeams}</td>
                <td style={{
                  padding: "6px 8px", textAlign: "right", fontWeight: 600,
                  color: e.totalNet >= 0 ? "#2ecc71" : "#e63946",
                }}>{fmt(e.totalNet)}</td>
              </tr>
            ))).sort((a, b) => {
              const aConc = parseFloat(a.props.children[3].props.children);
              const bConc = parseFloat(b.props.children[3].props.children);
              return bConc - aConc;
            })}
          </tbody>
        </table>
      </div>

      {/* Best & Worst Picks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 24 }}>
        <div>
          <SubTitle>Best Picks Ever</SubTitle>
          {bestPicks.map((t, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 10px",
              background: i === 0 ? "#111d2e" : "transparent",
              borderRadius: 6,
              fontSize: 11,
              borderBottom: "1px solid #111827",
            }}>
              <div>
                <span style={{ color: "#4a9eff", fontWeight: 600 }}>{t.t}</span>
                <span style={{ color: "#3a4a6a", marginLeft: 6, fontSize: 9 }}>({t.sd}) · {t.s} '{String(t.year).slice(2)}</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "#5a6a8a", fontSize: 10 }}>{fmtDollar(t.p)}</span>
                <span style={{ color: "#2ecc71", fontWeight: 700, minWidth: 60, textAlign: "right" }}>{fmt(t.n)}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <SubTitle>Worst Picks Ever</SubTitle>
          {worstPicks.map((t, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 10px",
              background: i === 0 ? "#1a1118" : "transparent",
              borderRadius: 6,
              fontSize: 11,
              borderBottom: "1px solid #111827",
            }}>
              <div>
                <span style={{ color: "#e63946", fontWeight: 600 }}>{t.t}</span>
                <span style={{ color: "#3a4a6a", marginLeft: 6, fontSize: 9 }}>({t.sd}) · {t.s} '{String(t.year).slice(2)}</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "#5a6a8a", fontSize: 10 }}>{fmtDollar(t.p)}</span>
                <span style={{ color: "#e63946", fontWeight: 700, minWidth: 60, textAlign: "right" }}>{fmt(t.n)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Rules */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle>🎯 Actionable Rules (2023-2025 Data)</SectionTitle>
        
        <div style={{ display: "grid", gap: 12 }}>
          {/* Rule 1: The Anchor */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #2ecc7133" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>⚓</span>
              <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 13 }}>RULE 1: Anchor with a 1-Seed</span>
            </div>
            <div style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6 }}>
              <strong style={{ color: "#e8e6e3" }}>75% of 1-seeds made Sweet 16</strong> (9/12). Best S16 rate of any seed. 
              At ~$2,000 avg price, you get the highest probability of a deep run. 
              <span style={{ color: "#2ecc71" }}> Every winner had at least one team that went to the Final Four.</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a9eff", marginTop: 6 }}>
              → Budget $1,800-2,500 for your anchor 1-seed
            </div>
          </div>

          {/* Rule 2: Avoid the Death Zone */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #e6394633" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>💀</span>
              <span style={{ color: "#e63946", fontWeight: 700, fontSize: 13 }}>RULE 2: Avoid the Death Zone (8-10 Seeds)</span>
            </div>
            <div style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6 }}>
              <strong style={{ color: "#e8e6e3" }}>8-10 seeds have 15% combined S16 rate</strong> but cost $200-300 each. 
              They face 1-2 seeds in R2, making S16 nearly impossible. 
              <span style={{ color: "#e63946" }}> Worst ROI zone in the entire tournament.</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a9eff", marginTop: 6 }}>
              → Skip 8-10 seeds unless price is under $150
            </div>
          </div>

          {/* Rule 3: 5-Seeds are Gold */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #e9c46a33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🥇</span>
              <span style={{ color: "#e9c46a", fontWeight: 700, fontSize: 13 }}>RULE 3: Load Up on 5-Seeds</span>
            </div>
            <div style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6 }}>
              <strong style={{ color: "#e8e6e3" }}>5-seeds: 42% S16 rate at only $550 avg</strong>. Best value in the bracket. 
              They dodge 1-seeds until Elite 8, face 4 or 12 in R2. 
              <span style={{ color: "#2ecc71" }}> SDSU, Miami, Gonzaga all hit big from the 5-line.</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a9eff", marginTop: 6 }}>
              → Target 2-3 five-seeds at $400-700 each
            </div>
          </div>

          {/* Rule 4: Cinderella Insurance */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #7c5cfc33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🎰</span>
              <span style={{ color: "#7c5cfc", fontWeight: 700, fontSize: 13 }}>RULE 4: Buy Cinderella Insurance</span>
            </div>
            <div style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6 }}>
              <strong style={{ color: "#e8e6e3" }}>11-seeds have 25% S16 rate</strong> - they're underpriced at ~$220. 
              11 vs 6 matchups are often coin flips. 
              <span style={{ color: "#7c5cfc" }}> NC State went from 11-seed to Final Four in 2024!</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a9eff", marginTop: 6 }}>
              → Grab 1-2 eleven-seeds under $250 each
            </div>
          </div>

          {/* Rule 5: Don't Overpay for 2s */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #4a9eff33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ color: "#4a9eff", fontWeight: 700, fontSize: 13 }}>RULE 5: Don't Overpay for 2-Seeds</span>
            </div>
            <div style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6 }}>
              <strong style={{ color: "#e8e6e3" }}>2-seeds: 50% S16 rate but cost $1,550 avg</strong> - nearly as much as 1-seeds. 
              They face dangerous 7-10 seeds in R1/R2. 
              <span style={{ color: "#e9c46a" }}> If 2-seed price exceeds 80% of 1-seed price, pivot to the 1.</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a9eff", marginTop: 6 }}>
              → Only buy 2-seeds under $1,400
            </div>
          </div>

          {/* Rule 6: Spread or Package Strategy */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #2a9d8f33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>📊</span>
              <span style={{ color: "#2a9d8f", fontWeight: 700, fontSize: 13 }}>RULE 6: The 16-Seed Spread Play</span>
            </div>
            <div style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6 }}>
              <strong style={{ color: "#e8e6e3" }}>42% of 16-seeds covered the spread</strong> (5/12). 
              At ~$50 per package, you get 4 lottery tickets for $200. 
              <span style={{ color: "#2ecc71" }}> FDU actually won outright in 2023!</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a9eff", marginTop: 6 }}>
              → Always buy the 16-seed package if under $60 total
            </div>
          </div>
        </div>

        {/* Quick Budget Template */}
        <div style={{ marginTop: 20, background: "#0d1321", borderRadius: 8, padding: 14, border: "1px solid #4a9eff" }}>
          <div style={{ fontSize: 12, color: "#4a9eff", fontWeight: 700, marginBottom: 10 }}>
            💰 SAMPLE $3,000 BUDGET ALLOCATION
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40" }}>
              <span style={{ color: "#8a9aba" }}>1× Anchor 1-seed</span>
              <span style={{ color: "#2ecc71", fontWeight: 600 }}>$1,800</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40" }}>
              <span style={{ color: "#8a9aba" }}>2× Value 5-seeds</span>
              <span style={{ color: "#e9c46a", fontWeight: 600 }}>$500</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40" }}>
              <span style={{ color: "#8a9aba" }}>1× Cinderella 11-seed</span>
              <span style={{ color: "#7c5cfc", fontWeight: 600 }}>$200</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40" }}>
              <span style={{ color: "#8a9aba" }}>1× 16-seed package</span>
              <span style={{ color: "#4a9eff", fontWeight: 600 }}>$50</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2a40" }}>
              <span style={{ color: "#8a9aba" }}>Steal round reserve</span>
              <span style={{ color: "#5a6a8a", fontWeight: 600 }}>$450</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700 }}>
              <span style={{ color: "#e8e6e3" }}>TOTAL</span>
              <span style={{ color: "#e8e6e3" }}>$3,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ HOGAN CALCUTTA INTELLIGENCE (moved from 2026 Prep) ══════ */}
      <div style={{ marginTop: 28 }}>
        <SectionTitle>Hogan Calcutta Intelligence (3-Year Analysis)</SectionTitle>

        <div style={{
          background: "linear-gradient(135deg, #111827, #1a2a3e)", borderRadius: 10, padding: 16,
          border: "1px solid #4a9eff44", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: "#4a9eff", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
            The #1 Rule: Sweet 16 Teams = 89% of All Money
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { yr: "2023", pct: "89%", s16roi: "110%" },
              { yr: "2024", pct: "87%", s16roi: "52%" },
              { yr: "2025", pct: "90%", s16roi: "51%" },
            ].map(d => (
              <div key={d.yr} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#4a6a8a" }}>{d.yr}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2ecc71", fontFamily: "'Space Grotesk', sans-serif" }}>{d.pct}</div>
                <div style={{ fontSize: 9, color: "#5a6a8a" }}>of pot → S16 teams</div>
                <div style={{ fontSize: 11, color: "#2ecc71", fontWeight: 600, marginTop: 4 }}>{d.s16roi} ROI</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#8a9aba", lineHeight: 1.6 }}>
            Teams that don't make the Sweet 16 collectively lose money every single year. Your entire strategy should maximize S16 ownership.
          </div>
        </div>

        <SubTitle>Which S16 Teams Make the Most Money?</SubTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Cheap S16 ($50-500)", roi: "449%", color: "#7c5cfc", ex: "FAU '23, NC State '24, Princeton '23, Oakland '24, Arkansas '25" },
            { label: "Mid S16 ($500-1500)", roi: "85%", color: "#4a9eff", ex: "SDSU '23, Clemson '24, Alabama '24, BYU '25" },
            { label: "Expensive S16 ($1500+)", roi: "10%", color: "#e9c46a", ex: "Champs barely profit. Houston '24 at $2650 = -$1586" },
          ].map(d => (
            <div key={d.label} style={{ background: "#111827", borderRadius: 8, padding: 12, border: `1px solid ${d.color}33` }}>
              <div style={{ fontSize: 9, color: d.color, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{d.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: d.color, fontFamily: "'Space Grotesk', sans-serif", marginTop: 4 }}>{d.roi}</div>
              <div style={{ fontSize: 9, color: "#5a6a8a" }}>3yr avg ROI</div>
              <div style={{ fontSize: 8, color: "#4a5a7a", marginTop: 4 }}>{d.ex}</div>
            </div>
          ))}
        </div>

        <SubTitle>What Winners Did</SubTitle>
        <div style={{ maxHeight: 260, overflowY: "auto", borderRadius: 8 }}>
          {[
            { yr:"2023", name:"Bacon", spent:"$3,650", roi:"+145%", s16:3, key:"UConn $1,020 + SDSU $620 + Tennessee $780", insight:"Two mid-priced S16 teams + cheap Cinderella champ" },
            { yr:"2024", name:"Curran", spent:"$3,360", roi:"+127%", s16:3, key:"Purdue $2,800 + NC State $200 + Oakland $60", insight:"One big dog + two dirt-cheap Cinderellas" },
            { yr:"2024", name:"Hudachek", spent:"$5,530", roi:"+70%", s16:2, key:"UConn $3,350 + Alabama $680", insight:"All-in on champ + cheap 4-seed that ran" },
            { yr:"2025", name:"Crumbling", spent:"$4,450", roi:"+37%", s16:3, key:"Florida $2,800 + Purdue $550 + Kentucky $700", insight:"Champ anchor + two value 3-4 seeds" },
            { yr:"2025", name:"Bacon", spent:"$4,540", roi:"+34%", s16:2, key:"Houston $1,900 + Tennessee $1,350", insight:"Two strong 2-seeds, both made S16+" },
          ].map((w, i) => (
            <div key={i} style={{ padding: "8px 10px", borderBottom: "1px solid #111827", background: i === 0 ? "#111d2e" : "transparent", borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{w.name} <span style={{ color: "#3a4a6a", fontSize: 9 }}>{w.yr} · {w.spent}</span></span>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#4a9eff" }}>{w.s16} S16</span>
                  <span style={{ color: "#2ecc71", fontWeight: 700 }}>{w.roi}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#8a9aba", marginTop: 2 }}>{w.key}</div>
              <div style={{ fontSize: 9, color: "#e9c46a", marginTop: 1 }}>{w.insight}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <SubTitle>Calcutta Strategy (Applied to Hogan Rules)</SubTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            {[
              { title: "Portfolio > Single Pick", body: "Winners averaged 2.4 S16 teams. Every year at least one expensive 1-2 seed flames out (Alabama '23, Houston '24, St. John's '25). Diversify." },
              { title: "South Region = Cheapest", body: "First region auctioned is 15-20% cheaper than the last. South teams are your best value. Houston/Illinois/Vanderbilt going early = opportunity." },
              { title: "Stay Under $3K for Steal Round", body: "Budget $2,800-2,900 in Round 1. The steal round lets you poach overpaid teams. 10% juice still profitable if team was bought 20%+ over fair value." },
              { title: "Buy S16 Probability, Not Names", body: "Vanderbilt (55% S16) will go cheaper than UNC (25% S16, star OUT). Iowa (30%, underseeded) cheaper than a 7-seed with same odds. This is the edge." },
              { title: "9s and 11s Are Cinderella Gold", body: "Made S16 in 8 of last 9 tourneys at Hogan prices of $150-250. One S16 run pays for 5+ failed tickets. FAU ($220→+$2,588), NC State ($200→+$2,994)." },
              { title: "Don't Cannibalize Your Bracket", body: "Don't buy the 1-seed AND 4-5 seed in the same region half — one kills the other in the S16. Pick a side." },
              { title: "Duke Goes Last = Wild Card", body: "Last 1-seed is often 10-15% cheaper due to budget exhaustion. If the room is tapped, Duke could be a steal. If not, let someone else overpay for the Foster injury risk." },
            ].map((p, i) => (
              <div key={i} style={{ background: "#111827", borderRadius: 6, padding: "8px 10px", border: "1px solid #1e2a40" }}>
                <div style={{ fontSize: 10, color: "#e9c46a", fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: 9, color: "#7a8aaa", lineHeight: 1.5, marginTop: 2 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, background: "linear-gradient(135deg, #111827, #1a1f2e)", borderRadius: 10, padding: 14, border: "1px solid #2ecc7144" }}>
          <div style={{ fontSize: 11, color: "#2ecc71", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            Model Portfolio (~$2,900)
          </div>
          {[
            { t: "Houston (2S)", price: "$1,800", s16: "82%", role: "Anchor" },
            { t: "Vanderbilt (5S)", price: "$450", s16: "55%", role: "Value" },
            { t: "Saint Louis (9MW)", price: "$170", s16: "32%", role: "Cheap" },
            { t: "VCU (11S)", price: "$200", s16: "25%", role: "Cinderella" },
            { t: "Iowa (9S)", price: "$160", s16: "30%", role: "Underseeded" },
            { t: "15-seed pair", price: "$70", s16: "ATS", role: "Lottery" },
          ].map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #1a2a3e", fontSize: 11 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#2ecc7122", color: "#2ecc71", fontWeight: 600 }}>{p.role}</span>
                <span style={{ fontWeight: 500 }}>{p.t}</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "#4a9eff", fontSize: 10 }}>{p.s16}</span>
                <span style={{ fontWeight: 600, minWidth: 45, textAlign: "right" }}>{p.price}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 9, color: "#5a6a8a", marginTop: 6 }}>
            ~$2,850 total · 5 S16 shots · Steal round eligible · Need 2+ S16 = profit
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TEAM EXPLORER
// ═══════════════════════════════════════════

function TeamExplorer({ year }) {
  const [sortKey, setSortKey] = useState("net");
  const [sortDir, setSortDir] = useState("desc");
  const [filterSyndicate, setFilterSyndicate] = useState("All");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir(key === "team" || key === "syndicate" ? "asc" : "desc");
    }
  };

  const teams = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    let filtered = ALL_TEAMS.filter(t => years.includes(t.year));
    if (filterSyndicate !== "All") filtered = filtered.filter(t => t.s === filterSyndicate);
    const dir = sortDir === "desc" ? 1 : -1;
    const sortFns = {
      net: (a, b) => dir * (b.n - a.n),
      price: (a, b) => dir * (b.p - a.p),
      seed: (a, b) => dir * (a.seed - b.seed),
      roi: (a, b) => dir * ((b.p ? b.n / b.p : 0) - (a.p ? a.n / a.p : 0)),
      team: (a, b) => dir * a.t.localeCompare(b.t),
      syndicate: (a, b) => dir * a.s.localeCompare(b.s),
      won: (a, b) => dir * (b.w - a.w),
      year: (a, b) => dir * (b.year - a.year),
    };
    return filtered.sort(sortFns[sortKey] || sortFns.net);
  }, [year, sortKey, sortDir, filterSyndicate]);

  const allNames = [...new Set(ALL_TEAMS.map(t => t.s))].sort();

  const columns = [
    { key: "team", label: "Team", align: "left" },
    { key: "seed", label: "Seed", align: "left" },
    { key: "syndicate", label: "Syndicate", align: "left" },
    { key: "price", label: "Price", align: "right" },
    { key: "won", label: "Won", align: "right" },
    { key: "net", label: "Net", align: "right" },
    { key: "roi", label: "ROI", align: "right" },
  ];

  const arrow = (key) => sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <div>
      <SectionTitle>Team Explorer</SectionTitle>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1 }}>SYNDICATE:</span>
        <select
          value={filterSyndicate}
          onChange={e => setFilterSyndicate(e.target.value)}
          style={{
            background: "#111827",
            border: "1px solid #1e2a40",
            borderRadius: 4,
            color: "#e8e6e3",
            padding: "4px 8px",
            fontFamily: "inherit",
            fontSize: 10,
          }}
        >
          <option value="All">All</option>
          {allNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 9, color: "#3a4a6a", marginLeft: 8 }}>Tap any column header to sort</span>
      </div>

      <div style={{ maxHeight: 600, overflowY: "auto", borderRadius: 8, border: "1px solid #1e2a40" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: "#0d1321", zIndex: 1 }}>
            <tr style={{ borderBottom: "1px solid #1e2a40" }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: "8px 8px",
                    textAlign: col.align,
                    color: sortKey === col.key ? "#4a9eff" : "#4a6a8a",
                    fontWeight: sortKey === col.key ? 700 : 500,
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    userSelect: "none",
                    borderBottom: sortKey === col.key ? "2px solid #4a9eff" : "none",
                  }}
                >{col.label}{arrow(col.key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => {
              const roi = t.p ? t.n / t.p : 0;
              return (
                <tr key={i} style={{ borderBottom: "1px solid #0d1321" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 500 }}>{t.t} <span style={{ fontSize: 9, color: "#3a4a6a", fontWeight: 400 }}>'{String(t.year).slice(2)}</span></td>
                  <td style={{ padding: "6px 8px", color: "#5a6a8a" }}>{t.sd}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: 1,
                        background: SYNDICATE_COLORS[t.s] || "#555",
                      }} />
                      <span style={{ color: "#8a9aba", fontSize: 10 }}>{t.s}</span>
                    </div>
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#7a8aaa" }}>{fmtDollar(t.p)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#7a8aaa" }}>{fmtDollar(t.w)}</td>
                  <td style={{
                    padding: "6px 8px", textAlign: "right", fontWeight: 700,
                    color: t.n >= 0 ? "#2ecc71" : "#e63946",
                  }}>{fmt(t.n)}</td>
                  <td style={{
                    padding: "6px 8px", textAlign: "right",
                    color: roi >= 0 ? "#2ecc71" : "#e63946",
                    fontSize: 10,
                  }}>{fmtPct(roi)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: "#3a4a6a", marginTop: 8, textAlign: "center" }}>
        Showing {teams.length} teams
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// BRACKET VIEW COMPONENTS
// ═══════════════════════════════════════════

function RegionBracket({ region }) {
  const ORDER = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
  const getTeam = (s) => BRACKET_2026.find(t => t.r === region && t.s === s);
  const SLOT_H = 24;
  const TOTAL_H = 500;
  const regionMeta = {
    S: { name: "SOUTH", color: "#e63946" },
    MW: { name: "MIDWEST", color: "#e9c46a" },
    W: { name: "WEST", color: "#2ecc71" },
    E: { name: "EAST", color: "#4a9eff" },
  };
  const meta = regionMeta[region] || regionMeta.E;

  const Slot = ({ team, border }) => {
    if (!team) return (
      <div style={{ height: SLOT_H, display: 'flex', alignItems: 'center', padding: '0 6px', background: '#0a0e15', borderBottom: border ? '1px solid #151d2e' : 'none', fontSize: 9, color: '#1e2a40' }}>—</div>
    );
    const n = parseInt(team.s16) || 0;
    return (
      <div style={{ height: SLOT_H, display: 'flex', alignItems: 'center', padding: '0 4px', background: team.s <= 2 ? '#14203a' : '#0d1321', borderBottom: border ? '1px solid #1e2a40' : 'none', gap: 2 }}>
        <span style={{ width: 14, fontSize: 9, fontWeight: 700, textAlign: 'center', flexShrink: 0, color: team.s <= 2 ? '#4a9eff' : team.s <= 4 ? '#7c5cfc' : '#5a6a8a' }}>{team.s}</span>
        <span style={{ flex: 1, fontSize: 8, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c8d6e5' }}>{team.t}</span>
        <span style={{ fontSize: 7, fontWeight: 700, flexShrink: 0, color: n >= 50 ? '#2ecc71' : n >= 25 ? '#e9c46a' : '#3a4a6a' }}>{team.s16}</span>
      </div>
    );
  };

  const Match = ({ top, bot }) => (
    <div style={{ border: '1px solid #1e2a40', borderRadius: 3, overflow: 'hidden' }}>
      <Slot team={top} border />
      <Slot team={bot} />
    </div>
  );

  const Conn = ({ pairs }) => (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 16, flexShrink: 0 }}>
      {Array.from({ length: pairs }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ width: '100%', height: '50%', borderRight: '2px solid #1e2a40', borderTop: '2px solid #1e2a40', borderBottom: '2px solid #1e2a40', borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
        </div>
      ))}
    </div>
  );

  const r64 = ORDER.map(([a, b]) => [getTeam(a), getTeam(b)]);
  const roundCols = [
    { w: 130, label: 'FIRST ROUND' },
    { w: 16, label: '' },
    { w: 95, label: 'SECOND ROUND' },
    { w: 16, label: '' },
    { w: 95, label: 'SWEET 16' },
    { w: 16, label: '' },
    { w: 95, label: 'ELITE 8' },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 8, padding: '6px 0', borderBottom: `2px solid ${meta.color}44` }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: meta.color }}>{meta.name} REGION</span>
      </div>
      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
          paddingBottom: 8,
          paddingTop: 4,
          border: "1px solid #1e2a40",
          borderRadius: 8,
          background: "#080c12",
          marginLeft: -4,
          marginRight: -4,
        }}
        aria-label="Regional bracket — scroll horizontally to see all rounds"
      >
        <div style={{ fontSize: 8, color: "#7c5cfc", textAlign: "center", padding: "4px 8px 6px", fontWeight: 600 }}>
          ← Swipe / scroll sideways for full bracket →
        </div>
        <div style={{ display: 'flex', marginBottom: 4, minWidth: 480, paddingLeft: 8, paddingRight: 8 }}>
          {roundCols.map((c, i) => (
            <div key={i} style={{ width: c.w, minWidth: c.w, flexShrink: 0, textAlign: 'center', fontSize: 7, color: '#3a4a6a', letterSpacing: 1, fontWeight: 600 }}>{c.label}</div>
          ))}
        </div>
        <div style={{ display: 'flex', height: TOTAL_H, minWidth: 480, paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 130, minWidth: 130, flexShrink: 0 }}>
            {r64.map(([t, b], i) => <Match key={i} top={t} bot={b} />)}
          </div>
          <Conn pairs={4} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 95, minWidth: 95, flexShrink: 0 }}>
            {[0,1,2,3].map(i => <Match key={i} />)}
          </div>
          <Conn pairs={2} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 95, minWidth: 95, flexShrink: 0 }}>
            {[0,1].map(i => <Match key={i} />)}
          </div>
          <Conn pairs={1} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 95, minWidth: 95, flexShrink: 0 }}>
            <Match />
          </div>
        </div>
      </div>
    </div>
  );
}

function FinalFourBracket() {
  const regions = [
    { label: "East Winner", color: "#4a9eff" },
    { label: "South Winner", color: "#e63946" },
    { label: "West Winner", color: "#2ecc71" },
    { label: "Midwest Winner", color: "#e9c46a" },
  ];

  const RegSlot = ({ r, border }) => (
    <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', background: '#0d1321', borderBottom: border ? '1px solid #1e2a40' : 'none', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: '#c8d6e5' }}>{r.label}</span>
    </div>
  );

  const Empty = ({ border }) => (
    <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', background: '#0a0e15', borderBottom: border ? '1px solid #151d2e' : 'none', fontSize: 9, color: '#1e2a40' }}>—</div>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 8, padding: '6px 0', borderBottom: '2px solid #7c5cfc44' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#7c5cfc' }}>FINAL FOUR</span>
      </div>
      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
          border: "1px solid #1e2a40",
          borderRadius: 8,
          background: "#080c12",
          padding: "8px 8px 12px",
        }}
        aria-label="Final Four bracket"
      >
        <div style={{ fontSize: 8, color: "#7c5cfc", textAlign: "center", marginBottom: 6, fontWeight: 600 }}>
          ← Scroll if needed →
        </div>
        <div style={{ display: 'flex', marginBottom: 4, minWidth: 380 }}>
          {[{ w: 150, l: 'SEMIFINAL' }, { w: 16, l: '' }, { w: 130, l: 'CHAMPIONSHIP' }, { w: 16, l: '' }, { w: 70, l: '' }].map((c, i) => (
            <div key={i} style={{ width: c.w, minWidth: c.w, flexShrink: 0, textAlign: 'center', fontSize: 7, color: '#3a4a6a', letterSpacing: 1, fontWeight: 600 }}>{c.l}</div>
          ))}
        </div>
        <div style={{ display: 'flex', height: 200, minWidth: 380 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 150, minWidth: 150, flexShrink: 0 }}>
            <div style={{ border: '1px solid #1e2a40', borderRadius: 3, overflow: 'hidden' }}>
              <RegSlot r={regions[0]} border />
              <RegSlot r={regions[1]} />
            </div>
            <div style={{ border: '1px solid #1e2a40', borderRadius: 3, overflow: 'hidden' }}>
              <RegSlot r={regions[2]} border />
              <RegSlot r={regions[3]} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: 16, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ width: '100%', height: '50%', borderRight: '2px solid #1e2a40', borderTop: '2px solid #1e2a40', borderBottom: '2px solid #1e2a40', borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 130, minWidth: 130, flexShrink: 0 }}>
            <div style={{ border: '1px solid #1e2a40', borderRadius: 3, overflow: 'hidden' }}>
              <Empty border />
              <Empty />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', width: 16, flexShrink: 0, justifyContent: 'center' }}>
            <div style={{ width: '100%', height: 2, background: '#1e2a40' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 70, minWidth: 70, flexShrink: 0 }}>
            <div style={{ border: '2px solid #7c5cfc44', borderRadius: 6, padding: '10px 8px', textAlign: 'center', background: '#111827' }}>
              <div style={{ fontSize: 8, color: '#7c5cfc', letterSpacing: 1, fontWeight: 600 }}>CHAMP</div>
              <div style={{ fontSize: 16, marginTop: 2 }}>🏆</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2026 AUCTION PREP
// ═══════════════════════════════════════════

function AuctionPrep() {
  const [regionFilter, setRegionFilter] = useState("All");
  const [seedFilter, setSeedFilter] = useState("All");
  const [viewMode, setViewMode] = useState("bracket");
  const [bracketRegion, setBracketRegion] = useState("E");

  const getTier = (odds) => {
    const num = parseInt(odds.replace("+", ""));
    if (num <= 700) return "Elite";
    if (num <= 2000) return "Contender";
    if (num <= 5000) return "Mid";
    if (num <= 10000) return "Long Shot";
    return "Lottery";
  };

  const tierColors = { Elite: "#e63946", Contender: "#e9c46a", Mid: "#4a9eff", "Long Shot": "#7c5cfc", Lottery: "#3a4a6a" };

  const filteredBracket = useMemo(() => {
    let data = BRACKET_2026;
    if (regionFilter !== "All") data = data.filter(t => t.r === regionFilter);
    if (seedFilter !== "All") {
      const seeds = seedFilter.split(",").map(Number);
      data = data.filter(t => seeds.includes(t.s));
    }
    return data;
  }, [regionFilter, seedFilter]);

  const regions = ["All", "S", "MW", "W", "E"];
  const regionLabels = { All: "All", S: "South", MW: "Midwest", W: "West", E: "East" };
  const seedGroups = [
    { label: "All", value: "All" },
    { label: "1-2", value: "1,2" },
    { label: "3-4", value: "3,4" },
    { label: "5-6", value: "5,6" },
    { label: "7-8", value: "7,8" },
    { label: "9-11", value: "9,10,11" },
    { label: "12-16", value: "12,13,14,15,16" },
  ];

  return (
    <div>
      <SectionTitle>2026 Auction Prep</SectionTitle>

      {/* View Toggle — bracket is wide; scroll/swipe horizontally on small screens */}
      <div style={{ marginBottom: 10, textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "#5a6a8a", letterSpacing: 0.5, marginBottom: 8, lineHeight: 1.4 }}>
          <strong style={{ color: "#e9c46a" }}>Regional bracket:</strong> tap <strong style={{ color: "#4a9eff" }}>Bracket</strong> below, then East / South / West / Midwest.
          On phone, <strong style={{ color: "#c8d6e5" }}>swipe left</strong> on the bracket to see all rounds.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {["bracket", "list"].map(m => (
            <button key={m} type="button" onClick={() => setViewMode(m)} style={{
              padding: "10px 22px", background: viewMode === m ? "#4a9eff" : "transparent",
              border: `1px solid ${viewMode === m ? "#4a9eff" : "#1e2a40"}`, borderRadius: 6,
              color: viewMode === m ? "#0a0e17" : "#5a6a8a", fontFamily: "inherit", fontSize: 13,
              fontWeight: viewMode === m ? 700 : 500, cursor: "pointer", letterSpacing: 0.5,
            }}>{m === "list" ? "📋 List (filter)" : "🏆 Bracket"}</button>
          ))}
        </div>
      </div>

      {viewMode === "list" ? (
      <>
      {/* Filters - stacked for mobile */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {regions.map(r => (
            <button key={r} onClick={() => setRegionFilter(r)} style={{
              padding: "6px 12px", background: regionFilter === r ? "#4a9eff" : "transparent",
              border: `1px solid ${regionFilter === r ? "#4a9eff" : "#1e2a40"}`, borderRadius: 4,
              color: regionFilter === r ? "#0a0e17" : "#5a6a8a", fontFamily: "inherit", fontSize: 11,
              fontWeight: regionFilter === r ? 700 : 400, cursor: "pointer",
            }}>{regionLabels[r]}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {seedGroups.map(sg => (
            <button key={sg.value} onClick={() => setSeedFilter(sg.value)} style={{
              padding: "6px 10px", background: seedFilter === sg.value ? "#4a9eff" : "transparent",
              border: `1px solid ${seedFilter === sg.value ? "#4a9eff" : "#1e2a40"}`, borderRadius: 4,
              color: seedFilter === sg.value ? "#0a0e17" : "#5a6a8a", fontFamily: "inherit", fontSize: 10,
              fontWeight: seedFilter === sg.value ? 700 : 400, cursor: "pointer",
            }}>{sg.label}</button>
          ))}
        </div>
      </div>

      {/* Bracket - card list for mobile */}
      <div style={{ maxHeight: 480, overflowY: "auto", borderRadius: 8 }}>
        {filteredBracket.map((team, i) => {
          const tier = getTier(team.odds);
          const histAvg = HIST_AVG_PRICE[team.s] || 0;
          const isRegionStart = i === 0 || filteredBracket[i-1]?.r !== team.r;
          return (
            <div key={i}>
              {isRegionStart && (
                <div style={{
                  padding: "8px 10px 4px", fontSize: 10, fontWeight: 700, letterSpacing: 2,
                  color: "#4a9eff", textTransform: "uppercase",
                  borderTop: i > 0 ? "2px solid #1e2a40" : "none",
                  marginTop: i > 0 ? 8 : 0,
                }}>
                  {({S:"South Region (1st)", MW:"Midwest Region (2nd)", W:"West Region (3rd)", E:"East Region (Last)"})[team.r]}
                </div>
              )}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px",
                background: team.s <= 2 ? "#1A2A3E" : team.s <= 4 ? "#151D2E" : "transparent",
                borderBottom: "1px solid #111827",
                borderRadius: 4,
                gap: 8,
              }}>
                {/* Left: seed badge + team */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0,
                    background: team.s <= 2 ? "#4a9eff22" : team.s <= 4 ? "#7c5cfc15" : "#1a1f2e",
                    color: team.s <= 2 ? "#4a9eff" : team.s <= 4 ? "#7c5cfc" : "#6a7a9a",
                  }}>{team.s}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.t}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 8, padding: "1px 5px", borderRadius: 3,
                        background: `${tierColors[tier]}22`, color: tierColors[tier],
                        fontWeight: 600, letterSpacing: 0.5,
                      }}>{tier}</span>
                      {team.note && <span style={{ fontSize: 9, color: "#5a6a8a" }}>{team.note}</span>}
                    </div>
                  </div>
                </div>
                {/* Right: S16 odds + avg price */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                    color: parseInt(team.s16) >= 50 ? "#2ecc71" : parseInt(team.s16) >= 25 ? "#e9c46a" : "#5a6a8a",
                  }}>{team.s16}</div>
                  <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 1 }}>S16 odds</div>
                  <div style={{ fontSize: 10, color: "#5a6a8a", marginTop: 3 }}>{fmtDollar(histAvg)} avg</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 6, textAlign: "center" }}>
        Showing {filteredBracket.length} of 64 teams · Prices = historical avg for seed · ROI = 3yr avg for seed
      </div>
      </>
      ) : (
      <>
        {/* Region tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { key: "E", label: "East", color: "#4a9eff" },
            { key: "S", label: "South", color: "#e63946" },
            { key: "W", label: "West", color: "#2ecc71" },
            { key: "MW", label: "Midwest", color: "#e9c46a" },
          ].map(r => (
            <button key={r.key} onClick={() => setBracketRegion(r.key)} style={{
              padding: '6px 14px',
              background: bracketRegion === r.key ? r.color : 'transparent',
              border: `1px solid ${bracketRegion === r.key ? r.color : '#1e2a40'}`,
              borderRadius: 4,
              color: bracketRegion === r.key ? '#0a0e17' : r.color,
              fontFamily: 'inherit', fontSize: 11,
              fontWeight: bracketRegion === r.key ? 700 : 400,
              cursor: 'pointer',
            }}>{r.label}</button>
          ))}
        </div>

        <RegionBracket region={bracketRegion} />

        <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 6, textAlign: "center" }}>
          S16% = Sweet 16 implied probability (BetMGM/DK) · Tap region tabs to navigate
        </div>
      </>
      )}

      {/* Seed value summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        {[
          { label: "Sweet Spots", seeds: "1, 5, 9, 15-16", roi: "+20% avg", color: "#2ecc71" },
          { label: "Money Pits", seeds: "8, 10, 12-14", roi: "-50% avg", color: "#e63946" },
          { label: "Value Zone", seeds: "3, 6, 11", roi: "+5-19%", color: "#4a9eff" },
          { label: "High Variance", seeds: "2, 4, 7", roi: "-8 to -30%", color: "#e9c46a" },
        ].map(card => (
          <div key={card.label} style={{
            background: "#111827", borderRadius: 8, padding: "10px 12px",
            border: `1px solid ${card.color}33`,
          }}>
            <div style={{ fontSize: 9, color: card.color, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{card.label}</div>
            <div style={{ fontSize: 13, color: "#e8e6e3", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginTop: 3 }}>{card.seeds}</div>
            <div style={{ fontSize: 10, color: card.color, marginTop: 1 }}>{card.roi}</div>
          </div>
        ))}
      </div>

      {/* Recommended Targets — driven by S16%, historical seed pricing & ROI */}
      <div style={{ marginTop: 24 }}>
        <SubTitle>Recommended Targets</SubTitle>
        <div style={{ fontSize: 9, color: "#5a6a8a", marginBottom: 10, lineHeight: 1.5 }}>
          Based on S16 implied probability, 3-year historical avg price by seed, and seed-level ROI.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #2ecc7133" }}>
            <div style={{ fontSize: 10, color: "#2ecc71", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>High S16% / Strong ROI Seeds</div>
            {[
              { t: "Michigan", s: "1MW", s16: "92%", avg: "$2,100", roi: "+20%", why: "31-3, #1 KenPom. 1-seeds hit S16 75% of time at +20% ROI" },
              { t: "Arizona", s: "1W", s16: "92%", avg: "$2,100", roi: "+20%", why: "32-2, healthiest 1-seed. 1-seeds are highest-probability S16 bets" },
              { t: "Vanderbilt", s: "5S", s16: "55%", avg: "$550", roi: "+18%", why: "5-seeds: 42% S16 rate, best value in bracket at only $550 avg" },
              { t: "Texas Tech", s: "5MW", s16: "52%", avg: "$550", roi: "+18%", why: "5s dodge 1-seeds until E8, face 4/12 in R2. Strong Big 12 résumé" },
              { t: "St. John's", s: "5E", s16: "55%", avg: "$550", roi: "+18%", why: "BE champ, underseeded per Nate Silver. 5-seed sweet spot" },
              { t: "Illinois", s: "3S", s16: "68%", avg: "$950", roi: "+2%", why: "3-seeds are breakeven but high-floor at 68% S16. Young, explosive O" },
              { t: "Iowa", s: "9S", s16: "30%", avg: "$200", roi: "+30%", why: "9-seeds: +30% ROI at $200 avg. Underseeded per KenPom" },
              { t: "Saint Louis", s: "9MW", s16: "32%", avg: "$200", roi: "+30%", why: "A10 champ, top-15 O & D. 9s are historically underpriced" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: parseInt(pick.s16) >= 50 ? "#2ecc71" : "#e9c46a", fontWeight: 700, fontSize: 10 }}>{pick.s16}</span>
                    <span style={{ color: "#5a6a8a", fontSize: 9 }}>{pick.avg}</span>
                  </div>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #7c5cfc33" }}>
            <div style={{ fontSize: 10, color: "#7c5cfc", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Cinderella Value (cheap + positive ROI seeds)</div>
            {[
              { t: "VCU", s: "11S", s16: "25%", avg: "$220", roi: "+19%", why: "11-seeds: 25% S16 rate, +19% ROI. 16 of last 17 W, coin-flip vs 6-seed" },
              { t: "South Florida", s: "11E", s16: "20%", avg: "$220", roi: "+19%", why: "CBS sleeper pick. 11 vs 6 matchups are near coin flips historically" },
              { t: "BYU", s: "6W", s16: "40%", avg: "$420", roi: "+9%", why: "6-seeds: +9% ROI. Dybantsa = top-5 NBA pick, legit S16 contender" },
              { t: "Idaho", s: "15S", s16: "2%", avg: "$72", roi: "+32%", why: "15-seeds: +32% ROI at $72 avg. +23.5 spread = ATS lottery ticket" },
              { t: "16-seed pkg", s: "16", s16: "ATS", avg: "$48", roi: "+17%", why: "16s at ~$48 = cheapest lottery. 42% covered the spread over 3yrs" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#7c5cfc", fontWeight: 700, fontSize: 10 }}>{pick.s16}</span>
                    <span style={{ color: "#5a6a8a", fontSize: 9 }}>{pick.avg}</span>
                  </div>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fade list — seeds with negative ROI or bad S16% relative to price */}
      <div style={{ marginTop: 14, background: "#111827", borderRadius: 8, padding: 12, border: "1px solid #e6394633" }}>
        <div style={{ fontSize: 10, color: "#e63946", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
          Overpriced / Negative ROI — Fade or Buy Cheap
        </div>
        <div style={{ fontSize: 9, color: "#4a5a7a", marginBottom: 8 }}>Seeds with historically negative ROI or S16% that doesn't justify the price.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { t: "Georgia (8MW)", why: "8-seeds: -39% ROI, $250 avg. 315th pts allowed" },
            { t: "Louisville (6E)", why: "3-6 vs Top 25, Brown out. 32% S16 at $420 = thin" },
            { t: "Tennessee (6MW)", why: "Lost 4 of last 6. 38% S16 doesn't justify bidding war" },
            { t: "Missouri (10W)", why: "10-seeds: -48% ROI. Worst value zone in bracket" },
            { t: "Any 12-14 seed over $150", why: "12s -59%, 13s -77%, 14s -81% ROI. Don't chase" },
            { t: "Any 2-seed over $1,600", why: "2s: -15% ROI at $1,550 avg. Near 1-seed price, less upside" },
          ].map((fade, i) => (
            <div key={i} style={{ fontSize: 10, padding: "3px 0" }}>
              <span style={{ color: "#e63946", fontWeight: 600 }}>{fade.t}</span>
              <div style={{ color: "#4a5a7a", fontSize: 9 }}>{fade.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: 18,
      fontWeight: 600,
      margin: "0 0 16px 0",
      color: "#e8e6e3",
      paddingBottom: 8,
      borderBottom: "1px solid #1e2a40",
    }}>{children}</h2>
  );
}

function SubTitle({ children }) {
  return (
    <h3 style={{
      fontSize: 12,
      fontWeight: 600,
      margin: "0 0 10px 0",
      color: "#6a8aba",
      letterSpacing: 1,
      textTransform: "uppercase",
    }}>{children}</h3>
  );
}