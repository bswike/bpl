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
  return `${(n * 100).toFixed(1)}%`;
};
const fmtDollar = (n) => `$${Math.round(n).toLocaleString()}`;

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════

const BRACKET_2026 = [
  // South
  {r:"S",s:16,t:"PV A&M/Lehigh",odds:"+20000",note:"First Four"},
  {r:"S",s:15,t:"Idaho +23.5",odds:"+20000",note:"Paired w/ Furman"},
  {r:"S",s:14,t:"Penn",odds:"+20000",note:""},
  {r:"S",s:13,t:"Troy",odds:"+20000",note:""},
  {r:"S",s:12,t:"McNeese",odds:"+20000",note:"Back from '25"},
  {r:"S",s:11,t:"VCU",odds:"+10000",note:"16 of last 17 W"},
  {r:"S",s:10,t:"Texas A&M",odds:"+20000",note:""},
  {r:"S",s:9,t:"Iowa",odds:"+10000",note:""},
  {r:"S",s:8,t:"Clemson",odds:"+10000",note:""},
  {r:"S",s:7,t:"Saint Mary's",odds:"+10000",note:""},
  {r:"S",s:6,t:"North Carolina",odds:"+6000",note:""},
  {r:"S",s:5,t:"Vanderbilt",odds:"+5000",note:"Expert sleeper"},
  {r:"S",s:4,t:"Nebraska",odds:"+5000",note:""},
  {r:"S",s:3,t:"Illinois",odds:"+1900",note:"Young, explosive O"},
  {r:"S",s:2,t:"Houston",odds:"+1000",note:"Lost title game '25"},
  {r:"S",s:1,t:"Florida",odds:"+700",note:"Defending champ"},
  // Midwest
  {r:"MW",s:16,t:"Howard/UMBC",odds:"+20000",note:"First Four"},
  {r:"MW",s:15,t:"TN State +24.5",odds:"+20000",note:"Paired w/ Queens"},
  {r:"MW",s:14,t:"Wright State",odds:"+20000",note:""},
  {r:"MW",s:13,t:"Hofstra",odds:"+20000",note:""},
  {r:"MW",s:12,t:"Akron",odds:"+20000",note:""},
  {r:"MW",s:11,t:"SMU/Miami OH",odds:"+20000",note:"First Four"},
  {r:"MW",s:10,t:"Santa Clara",odds:"+20000",note:""},
  {r:"MW",s:9,t:"Saint Louis",odds:"+10000",note:"A10 champ"},
  {r:"MW",s:8,t:"Georgia",odds:"+10000",note:"315th pts allowed"},
  {r:"MW",s:7,t:"Kentucky",odds:"+5000",note:""},
  {r:"MW",s:6,t:"Tennessee",odds:"+4000",note:"Lost 4 of last 6"},
  {r:"MW",s:5,t:"Texas Tech",odds:"+4000",note:""},
  {r:"MW",s:4,t:"Alabama",odds:"+4000",note:"Cinderella candidate"},
  {r:"MW",s:3,t:"Virginia",odds:"+3000",note:""},
  {r:"MW",s:2,t:"Iowa State",odds:"+1800",note:"KenPom #4 defense"},
  {r:"MW",s:1,t:"Michigan",odds:"+350",note:"31-3, #1 KenPom"},
  // West
  {r:"W",s:16,t:"LIU +31.5",odds:"+20000",note:""},
  {r:"W",s:15,t:"Queens +25.5",odds:"+20000",note:"Paired w/ TN St"},
  {r:"W",s:14,t:"Kennesaw State",odds:"+20000",note:""},
  {r:"W",s:13,t:"Hawaii",odds:"+20000",note:"Big West champ"},
  {r:"W",s:12,t:"High Point",odds:"+20000",note:""},
  {r:"W",s:11,t:"Texas/NC State",odds:"+10000",note:"Texas won FF"},
  {r:"W",s:10,t:"Missouri",odds:"+20000",note:""},
  {r:"W",s:9,t:"Utah State",odds:"+10000",note:"MWC champ"},
  {r:"W",s:8,t:"Villanova",odds:"+10000",note:"Back in tourney"},
  {r:"W",s:7,t:"Miami FL",odds:"+10000",note:""},
  {r:"W",s:6,t:"BYU",odds:"+5000",note:"Dybantsa top-5 pick"},
  {r:"W",s:5,t:"Wisconsin",odds:"+5000",note:""},
  {r:"W",s:4,t:"Arkansas",odds:"+3000",note:"Calipari, SEC champ"},
  {r:"W",s:3,t:"Gonzaga",odds:"+2500",note:""},
  {r:"W",s:2,t:"Purdue",odds:"+3500",note:"B10 champ, contrarian"},
  {r:"W",s:1,t:"Arizona",odds:"+400",note:"32-2, healthiest 1"},
  // East
  {r:"E",s:16,t:"Siena +28.5",odds:"+20000",note:""},
  {r:"E",s:15,t:"Furman +20.5",odds:"+20000",note:"Paired w/ Idaho"},
  {r:"E",s:14,t:"N Dakota State",odds:"+20000",note:""},
  {r:"E",s:13,t:"Cal Baptist",odds:"+20000",note:""},
  {r:"E",s:12,t:"Northern Iowa",odds:"+20000",note:""},
  {r:"E",s:11,t:"South Florida",odds:"+10000",note:"CBS sleeper"},
  {r:"E",s:10,t:"UCF",odds:"+20000",note:""},
  {r:"E",s:9,t:"TCU",odds:"+10000",note:""},
  {r:"E",s:8,t:"Ohio State",odds:"+10000",note:""},
  {r:"E",s:7,t:"UCLA",odds:"+5000",note:""},
  {r:"E",s:6,t:"Louisville",odds:"+5000",note:"3-6 vs Top 25"},
  {r:"E",s:5,t:"St. John's",odds:"+5000",note:"BE champ, underseeded"},
  {r:"E",s:4,t:"Kansas",odds:"+4000",note:"Peterson = #1 pick?"},
  {r:"E",s:3,t:"Michigan State",odds:"+4000",note:""},
  {r:"E",s:2,t:"UConn",odds:"+1700",note:"2x champ Hurley"},
  {r:"E",s:1,t:"Duke",odds:"+300",note:"32-2, #1 overall, Boozer"},
];

const HIST_AVG_PRICE = {16:48,15:72,14:65,13:108,12:200,11:220,10:225,9:200,8:250,7:290,6:420,5:550,4:680,3:950,2:1550,1:2100};
const HIST_ROI = {16:0.17,15:0.32,14:-0.81,13:-0.77,12:-0.59,11:0.19,10:-0.48,9:0.30,8:-0.39,7:-0.30,6:0.09,5:0.18,4:-0.08,3:0.02,2:-0.15,1:0.20};

const TABS = ["2026 Prep", "Leaderboard", "Seed ROI", "Strategy", "Teams"];

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

      {/* Tab nav */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 4,
        marginBottom: 20,
        flexWrap: "wrap",
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 18px",
              background: activeTab === tab
                ? "linear-gradient(135deg, #4a9eff22, #7c5cfc22)"
                : "transparent",
              border: `1px solid ${activeTab === tab ? "#4a9eff" : "#1e2a40"}`,
              borderRadius: 6,
              color: activeTab === tab ? "#4a9eff" : "#5a6a8a",
              fontFamily: "inherit",
              fontSize: 12,
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
      if (!seedMap[s]) seedMap[s] = { seed: s, count: 0, totalSpent: 0, totalWon: 0, totalNet: 0, winners: 0 };
      seedMap[s].count++;
      seedMap[s].totalSpent += t.p;
      seedMap[s].totalWon += t.w;
      seedMap[s].totalNet += t.n;
      if (t.n > 0) seedMap[s].winners++;
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
              {["Seed", "Avg Price", "Total Net", "ROI", "Hit Rate", ""].map((h,i) => (
                <th key={i} style={{
                  padding: "8px 10px",
                  textAlign: i >= 1 ? "right" : "left",
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
            {data.map(d => {
              const barW = Math.abs(d.totalNet) / maxAbsNet * 100;
              const isPos = d.totalNet >= 0;
              const roi = d.totalSpent ? d.totalNet / d.totalSpent : 0;
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
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#7a8aaa" }}>{fmtDollar(d.totalSpent / d.count)}</td>
                  <td style={{
                    padding: "8px 10px", textAlign: "right", fontWeight: 700,
                    color: isPos ? "#2ecc71" : "#e63946",
                  }}>{fmt(d.totalNet)}</td>
                  <td style={{
                    padding: "8px 10px", textAlign: "right",
                    color: roi >= 0 ? "#2ecc71" : "#e63946",
                  }}>{fmtPct(roi)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#7a8aaa" }}>
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
    </div>
  );
}

// ═══════════════════════════════════════════
// TEAM EXPLORER
// ═══════════════════════════════════════════

function TeamExplorer({ year }) {
  const [sortKey, setSortKey] = useState("net");
  const [filterSyndicate, setFilterSyndicate] = useState("All");

  const teams = useMemo(() => {
    const years = year === "All" ? [2023, 2024, 2025] : [parseInt(year)];
    let filtered = ALL_TEAMS.filter(t => years.includes(t.year));
    if (filterSyndicate !== "All") filtered = filtered.filter(t => t.s === filterSyndicate);
    const sortFns = {
      net: (a, b) => b.n - a.n,
      price: (a, b) => b.p - a.p,
      seed: (a, b) => a.seed - b.seed,
      roi: (a, b) => (b.p ? b.n / b.p : 0) - (a.p ? a.n / a.p : 0),
    };
    return filtered.sort(sortFns[sortKey] || sortFns.net);
  }, [year, sortKey, filterSyndicate]);

  const allNames = [...new Set(ALL_TEAMS.map(t => t.s))].sort();

  return (
    <div>
      <SectionTitle>Team Explorer</SectionTitle>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1 }}>SORT:</span>
        {[["net", "Net P/L"], ["price", "Price"], ["seed", "Seed"], ["roi", "ROI"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSortKey(k)}
            style={{
              padding: "4px 10px",
              background: sortKey === k ? "#4a9eff22" : "transparent",
              border: `1px solid ${sortKey === k ? "#4a9eff" : "#1e2a40"}`,
              borderRadius: 4,
              color: sortKey === k ? "#4a9eff" : "#5a6a8a",
              fontFamily: "inherit",
              fontSize: 10,
              cursor: "pointer",
            }}
          >{label}</button>
        ))}
        <span style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1, marginLeft: 12 }}>SYNDICATE:</span>
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
      </div>

      <div style={{ maxHeight: 520, overflowY: "auto", borderRadius: 8, border: "1px solid #1e2a40" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: "#0d1321", zIndex: 1 }}>
            <tr style={{ borderBottom: "1px solid #1e2a40" }}>
              {["Team", "Seed", "Syndicate", "Price", "Won", "Net", "ROI", "Year"].map((h, i) => (
                <th key={i} style={{
                  padding: "8px 8px",
                  textAlign: i >= 3 ? "right" : "left",
                  color: "#4a6a8a",
                  fontWeight: 500,
                  fontSize: 9,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.slice(0, 100).map((t, i) => {
              const roi = t.p ? t.n / t.p : 0;
              return (
                <tr key={i} style={{ borderBottom: "1px solid #0d1321" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 500 }}>{t.t}</td>
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
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#3a4a6a", fontSize: 10 }}>{t.year}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: "#3a4a6a", marginTop: 8, textAlign: "center" }}>
        Showing {Math.min(teams.length, 100)} of {teams.length} teams
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2026 AUCTION PREP
// ═══════════════════════════════════════════

function AuctionPrep() {
  const [regionFilter, setRegionFilter] = useState("All");
  const [showTier, setShowTier] = useState("All");

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
    if (showTier !== "All") data = data.filter(t => getTier(t.odds) === showTier);
    return data;
  }, [regionFilter, showTier]);

  const regions = ["All", "S", "MW", "W", "E"];
  const regionLabels = { All: "All", S: "South", MW: "Midwest", W: "West", E: "East" };
  const tiers = ["All", "Elite", "Contender", "Mid", "Long Shot", "Lottery"];

  return (
    <div>
      <SectionTitle>2026 Auction Prep</SectionTitle>

      {/* Rules - compact */}
      <div style={{
        background: "#111827", borderRadius: 8, padding: "10px 12px", border: "1px solid #1e2a40", marginBottom: 14,
      }}>
        <div style={{ fontSize: 9, color: "#e9c46a", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
          Rules
        </div>
        <div style={{ fontSize: 10, color: "#8a9aba", lineHeight: 1.5 }}>
          $3K cap · 9 syndicates · South → MW → West → East · 
          16s packaged (DK spreads) · 15s paired · 1s/2s NOT randomized · 
          Last off board: Florida → Michigan → Arizona → Duke · 
          Steal round: under $3K only · 10% juice on steals
        </div>
      </div>

      {/* Strategy cards - 2x2 on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
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
          {tiers.map(t => (
            <button key={t} onClick={() => setShowTier(t)} style={{
              padding: "6px 10px", background: showTier === t ? `${tierColors[t] || "#4a9eff"}` : "transparent",
              border: `1px solid ${showTier === t ? (tierColors[t] || "#4a9eff") : "#1e2a40"}`, borderRadius: 4,
              color: showTier === t ? "#0a0e17" : (tierColors[t] || "#5a6a8a"), fontFamily: "inherit", fontSize: 10,
              fontWeight: showTier === t ? 700 : 400, cursor: "pointer",
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Bracket - card list for mobile */}
      <div style={{ maxHeight: 480, overflowY: "auto", borderRadius: 8 }}>
        {filteredBracket.map((team, i) => {
          const tier = getTier(team.odds);
          const histAvg = HIST_AVG_PRICE[team.s] || 0;
          const histRoi = HIST_ROI[team.s] || 0;
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
                {/* Right: price + ROI */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "#7a8aaa", fontWeight: 500 }}>{fmtDollar(histAvg)}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: histRoi >= 0 ? "#2ecc71" : "#e63946",
                  }}>{fmtPct(histRoi)} ROI</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 6, textAlign: "center" }}>
        Showing {filteredBracket.length} of 64 teams · Prices = historical avg for seed · ROI = 3yr avg for seed
      </div>

      {/* Target picks - stacked on mobile */}
      <div style={{ marginTop: 24 }}>
        <SubTitle>Recommended Targets</SubTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #e6394633" }}>
            <div style={{ fontSize: 10, color: "#e63946", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Big Dogs ($1,500+)</div>
            {[
              { t: "Houston", s: "2S", why: "Lost title game, elite D, +1000", target: "$1,800-2,100" },
              { t: "Iowa State", s: "2MW", why: "KenPom #4 defense, +1800", target: "$1,400-1,600" },
              { t: "UConn", s: "2E", why: "2x champ coach, +1700", target: "$1,400-1,700" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <span style={{ color: "#2ecc71", fontWeight: 600, fontSize: 10 }}>{pick.target}</span>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #4a9eff33" }}>
            <div style={{ fontSize: 10, color: "#4a9eff", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Value Picks ($200-800)</div>
            {[
              { t: "Illinois", s: "3S", why: "Young, explosive O, +1900", target: "$900-1,100" },
              { t: "Vanderbilt", s: "5S", why: "Expert sleeper pick, +5000", target: "$400-550" },
              { t: "BYU", s: "6W", why: "Dybantsa = top-5 NBA pick, +5000", target: "$350-450" },
              { t: "Saint Louis", s: "9MW", why: "A10 champ, elite metrics", target: "$150-200" },
              { t: "VCU", s: "11S", why: "16 of last 17 W, chameleon", target: "$180-250" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <span style={{ color: "#2ecc71", fontWeight: 600, fontSize: 10 }}>{pick.target}</span>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10, background: "#111827", borderRadius: 8, padding: 12, border: "1px solid #2ecc7133" }}>
          <div style={{ fontSize: 10, color: "#2ecc71", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Lottery Tickets ($40-150) — 15s/16s = +25% ROI</div>
          <div style={{ fontSize: 10, color: "#8a9aba", lineHeight: 1.7 }}>
            16-seed package (~$50) · Idaho +23.5 vs Houston · Furman +20.5 vs UConn · 
            South Florida (11E) · McNeese (12S) · Texas (11W, FF winner)
          </div>
        </div>
      </div>

      {/* Fade list */}
      <div style={{ marginTop: 14, background: "#111827", borderRadius: 8, padding: 12, border: "1px solid #e6394633" }}>
        <div style={{ fontSize: 10, color: "#e63946", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
          Fade List
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { t: "Louisville (6E)", why: "3-6 vs Top 25" },
            { t: "Georgia (8MW)", why: "315th pts allowed" },
            { t: "Tennessee (6MW)", why: "Lost 4 of last 6" },
            { t: "Florida (1S)", why: "Champ tax = overpay" },
            { t: "Duke (1E)", why: "Last off board, injury" },
          ].map((fade, i) => (
            <div key={i} style={{ fontSize: 10 }}>
              <span style={{ color: "#e63946", fontWeight: 600 }}>{fade.t}</span>
              <div style={{ color: "#4a5a7a", fontSize: 9 }}>{fade.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════

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