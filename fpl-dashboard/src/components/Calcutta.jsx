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
  // South — s16=BetMGM/DK, tr=T-Rank, em=EvanMiya S16%
  {r:"S",s:16,t:"PV A&M/Lehigh",odds:"+20000",s16:"<1%",tr:"<1%",em:"<1%",note:"First Four"},
  {r:"S",s:15,t:"Idaho +23.5",odds:"+20000",s16:"2%",tr:"<1%",em:"<1%",note:"Paired w/ Furman"},
  {r:"S",s:14,t:"Penn",odds:"+20000",s16:"2%",tr:"1%",em:"<1%",note:""},
  {r:"S",s:13,t:"Troy",odds:"+20000",s16:"5%",tr:"1%",em:"1%",note:""},
  {r:"S",s:12,t:"McNeese",odds:"+20000",s16:"13%",tr:"4%",em:"4%",note:"Back from '25"},
  {r:"S",s:11,t:"VCU",odds:"+10000",s16:"25%",tr:"6%",em:"9%",note:"16 of last 17 W, UNC hurt"},
  {r:"S",s:10,t:"Texas A&M",odds:"+20000",s16:"18%",tr:"8%",em:"4%",note:""},
  {r:"S",s:9,t:"Iowa",odds:"+10000",s16:"30%",tr:"12%",em:"9%",note:"Underseeded per KenPom"},
  {r:"S",s:8,t:"Clemson",odds:"+10000",s16:"22%",tr:"9%",em:"5%",note:""},
  {r:"S",s:7,t:"Saint Mary's",odds:"+10000",s16:"28%",tr:"15%",em:"13%",note:""},
  {r:"S",s:6,t:"North Carolina",odds:"+6000",s16:"25%",tr:"17%",em:"5%",note:"Wilson out (broken thumb)"},
  {r:"S",s:5,t:"Vanderbilt",odds:"+5000",s16:"55%",tr:"51%",em:"51%",note:"Expert sleeper, beat UF by 17"},
  {r:"S",s:4,t:"Nebraska",odds:"+5000",s16:"52%",tr:"45%",em:"44%",note:"Cheapest 4-seed"},
  {r:"S",s:3,t:"Illinois",odds:"+1900",s16:"68%",tr:"77%",em:"86%",note:"Young, explosive O"},
  {r:"S",s:2,t:"Houston",odds:"+1000",s16:"82%",tr:"76%",em:"83%",note:"Lost title game '25, elite D"},
  {r:"S",s:1,t:"Florida",odds:"+700",s16:"88%",tr:"79%",em:"86%",note:"Defending champ"},
  // Midwest
  {r:"MW",s:16,t:"Howard",odds:"+20000",s16:"<1%",tr:"<1%",em:"<1%",note:"Won First Four"},
  {r:"MW",s:15,t:"TN State +24.5",odds:"+20000",s16:"2%",tr:"<1%",em:"<1%",note:"Paired w/ Queens"},
  {r:"MW",s:14,t:"Wright State",odds:"+20000",s16:"2%",tr:"1%",em:"<1%",note:""},
  {r:"MW",s:13,t:"Hofstra",odds:"+20000",s16:"5%",tr:"3%",em:"6%",note:""},
  {r:"MW",s:12,t:"Akron",odds:"+20000",s16:"10%",tr:"4%",em:"8%",note:""},
  {r:"MW",s:11,t:"SMU/Miami OH",odds:"+20000",s16:"15%",tr:"5%",em:"3%",note:"First Four Wed"},
  {r:"MW",s:10,t:"Santa Clara",odds:"+20000",s16:"20%",tr:"13%",em:"6%",note:""},
  {r:"MW",s:9,t:"Saint Louis",odds:"+10000",s16:"32%",tr:"5%",em:"4%",note:"A10 champ, top-15 O & D"},
  {r:"MW",s:8,t:"Georgia",odds:"+10000",s16:"18%",tr:"8%",em:"3%",note:"315th pts allowed"},
  {r:"MW",s:7,t:"Kentucky",odds:"+5000",s16:"30%",tr:"11%",em:"13%",note:""},
  {r:"MW",s:6,t:"Tennessee",odds:"+4000",s16:"38%",tr:"40%",em:"42%",note:"Lost 4 of last 6"},
  {r:"MW",s:5,t:"Texas Tech",odds:"+4000",s16:"52%",tr:"49%",em:"29%",note:""},
  {r:"MW",s:4,t:"Alabama",odds:"+4000",s16:"55%",tr:"44%",em:"56%",note:"Cinderella candidate"},
  {r:"MW",s:3,t:"Virginia",odds:"+3000",s16:"60%",tr:"52%",em:"54%",note:""},
  {r:"MW",s:2,t:"Iowa State",odds:"+1800",s16:"78%",tr:"76%",em:"81%",note:"KenPom #4 defense"},
  {r:"MW",s:1,t:"Michigan",odds:"+350",s16:"92%",tr:"87%",em:"93%",note:"31-3, #1 KenPom"},
  // West
  {r:"W",s:16,t:"LIU +31.5",odds:"+20000",s16:"<1%",tr:"<1%",em:"<1%",note:""},
  {r:"W",s:15,t:"Queens +25.5",odds:"+20000",s16:"2%",tr:"<1%",em:"<1%",note:"Paired w/ TN St"},
  {r:"W",s:14,t:"Kennesaw State",odds:"+20000",s16:"2%",tr:"1%",em:"<1%",note:""},
  {r:"W",s:13,t:"Hawaii",odds:"+20000",s16:"8%",tr:"2%",em:"1%",note:"Unique no-help D"},
  {r:"W",s:12,t:"High Point",odds:"+20000",s16:"10%",tr:"3%",em:"3%",note:"Uptempo, 90 PPG"},
  {r:"W",s:11,t:"Texas",odds:"+10000",s16:"18%",tr:"13%",em:"15%",note:"Won First Four"},
  {r:"W",s:10,t:"Missouri",odds:"+20000",s16:"22%",tr:"9%",em:"3%",note:""},
  {r:"W",s:9,t:"Utah State",odds:"+10000",s16:"25%",tr:"10%",em:"7%",note:"MWC champ"},
  {r:"W",s:8,t:"Villanova",odds:"+10000",s16:"28%",tr:"7%",em:"3%",note:"Back in tourney"},
  {r:"W",s:7,t:"Miami FL",odds:"+10000",s16:"28%",tr:"14%",em:"12%",note:""},
  {r:"W",s:6,t:"BYU",odds:"+5000",s16:"40%",tr:"20%",em:"13%",note:"Dybantsa top-5 pick"},
  {r:"W",s:5,t:"Wisconsin",odds:"+5000",s16:"50%",tr:"44%",em:"30%",note:"Shoots 3s now"},
  {r:"W",s:4,t:"Arkansas",odds:"+3000",s16:"55%",tr:"51%",em:"66%",note:"Calipari curse as high seed"},
  {r:"W",s:3,t:"Gonzaga",odds:"+2500",s16:"65%",tr:"67%",em:"71%",note:"Top-3 seed first time since '23"},
  {r:"W",s:2,t:"Purdue",odds:"+3500",s16:"75%",tr:"77%",em:"85%",note:"B10 champ, broke assist record"},
  {r:"W",s:1,t:"Arizona",odds:"+400",s16:"92%",tr:"84%",em:"90%",note:"32-2, healthiest 1 seed"},
  // East
  {r:"E",s:16,t:"Siena +28.5",odds:"+20000",s16:"<1%",tr:"<1%",em:"<1%",note:""},
  {r:"E",s:15,t:"Furman +20.5",odds:"+20000",s16:"2%",tr:"<1%",em:"1%",note:"Paired w/ Idaho"},
  {r:"E",s:14,t:"N Dakota State",odds:"+20000",s16:"2%",tr:"1%",em:"1%",note:""},
  {r:"E",s:13,t:"Cal Baptist",odds:"+20000",s16:"5%",tr:"2%",em:"1%",note:""},
  {r:"E",s:12,t:"Northern Iowa",odds:"+20000",s16:"12%",tr:"5%",em:"4%",note:""},
  {r:"E",s:11,t:"South Florida",odds:"+10000",s16:"20%",tr:"7%",em:"9%",note:"CBS sleeper"},
  {r:"E",s:10,t:"UCF",odds:"+20000",s16:"18%",tr:"6%",em:"4%",note:""},
  {r:"E",s:9,t:"TCU",odds:"+10000",s16:"22%",tr:"3%",em:"3%",note:""},
  {r:"E",s:8,t:"Ohio State",odds:"+10000",s16:"25%",tr:"13%",em:"8%",note:""},
  {r:"E",s:7,t:"UCLA",odds:"+5000",s16:"35%",tr:"26%",em:"23%",note:""},
  {r:"E",s:6,t:"Louisville",odds:"+5000",s16:"32%",tr:"37%",em:"26%",note:"3-6 vs Top 25, Brown out"},
  {r:"E",s:5,t:"St. John's",odds:"+5000",s16:"55%",tr:"50%",em:"55%",note:"BE champ, underseeded per Nate Silver"},
  {r:"E",s:4,t:"Kansas",odds:"+4000",s16:"58%",tr:"43%",em:"41%",note:"Peterson = potential #1 pick"},
  {r:"E",s:3,t:"Michigan State",odds:"+4000",s16:"55%",tr:"54%",em:"64%",note:""},
  {r:"E",s:2,t:"UConn",odds:"+1700",s16:"78%",tr:"68%",em:"72%",note:"2x champ Hurley, Karaban back"},
  {r:"E",s:1,t:"Duke",odds:"+300",s16:"90%",tr:"84%",em:"89%",note:"32-2, #1 overall, Foster ?"},
];

const HIST_AVG_PRICE = {16:48,15:72,14:65,13:108,12:200,11:220,10:225,9:200,8:250,7:290,6:420,5:550,4:680,3:950,2:1550,1:2100};
const HIST_ROI = {16:0.17,15:0.32,14:-0.81,13:-0.77,12:-0.59,11:0.19,10:-0.48,9:0.30,8:-0.39,7:-0.30,6:0.09,5:0.18,4:-0.08,3:0.02,2:-0.15,1:0.20};
// Seed pricing stats from 2023-2025 Hogan data: [min, max, avg, median]
const SEED_PRICES = {
  1:[1200,3350,2064,1810],2:[1200,2150,1570,1490],3:[680,1400,1001,1025],4:[480,1020,712,665],
  5:[240,1000,558,545],6:[220,740,405,390],7:[150,400,273,255],8:[160,400,245,210],
  9:[140,320,207,185],10:[140,340,233,225],11:[140,360,215,200],12:[140,270,213,215],
  13:[60,220,109,95],14:[40,80,62,60],15:[70,80,73,70],16:[45,60,52,50],
};
// Round-by-round probabilities: [R32, S16, E8, F4, F2, Champ] as decimals — T-Rank model
const TORIK_ROUNDS = {
  "S-16":[.009,0,0,0,0,0],"S-15":[.037,.005,0,0,0,0],"S-14":[.036,.006,0,0,0,0],"S-13":[.081,.008,0,0,0,0],
  "S-12":[.156,.038,.005,.001,0,0],"S-11":[.366,.062,.012,.002,0,0],"S-10":[.398,.077,.02,.005,.001,0],
  "S-9":[.539,.118,.048,.013,.004,.001],"S-8":[.461,.088,.033,.008,.002,0],"S-7":[.602,.154,.05,.015,.004,.001],
  "S-6":[.634,.166,.048,.013,.003,.001],"S-5":[.844,.506,.197,.076,.03,.01],"S-4":[.919,.448,.153,.052,.017,.005],
  "S-3":[.964,.767,.419,.233,.117,.056],"S-2":[.963,.764,.45,.258,.137,.069],"S-1":[.991,.793,.564,.324,.176,.093],
  "MW-16":[.016,.002,0,0,0,0],"MW-15":[.023,.001,0,0,0,0],"MW-14":[.079,.01,.001,0,0,0],"MW-13":[.146,.025,.002,0,0,0],
  "MW-12":[.168,.042,.004,.001,0,0],"MW-11":[.237,.07,.016,.003,.001,0],"MW-10":[.518,.129,.048,.011,.003,.001],
  "MW-9":[.45,.054,.016,.004,.001,0],"MW-8":[.55,.078,.027,.008,.002,0],"MW-7":[.482,.114,.041,.009,.002,0],
  "MW-6":[.763,.399,.172,.058,.022,.007],"MW-5":[.832,.492,.157,.072,.029,.01],"MW-4":[.854,.442,.128,.054,.019,.006],
  "MW-3":[.921,.521,.229,.079,.029,.01],"MW-2":[.977,.756,.494,.231,.115,.052],"MW-1":[.984,.866,.666,.471,.297,.179],
  "W-16":[.011,.001,0,0,0,0],"W-15":[.03,.003,0,0,0,0],"W-14":[.064,.009,.001,0,0,0],"W-13":[.106,.018,.001,0,0,0],
  "W-12":[.152,.028,.002,0,0,0],"W-11":[.434,.128,.032,.006,.001,0],"W-10":[.432,.085,.027,.005,.001,0],
  "W-9":[.544,.096,.04,.013,.004,.001],"W-8":[.456,.068,.025,.008,.002,0],"W-7":[.568,.138,.052,.012,.003,0],
  "W-6":[.566,.196,.058,.014,.003,.001],"W-5":[.848,.443,.13,.052,.016,.005],"W-4":[.894,.511,.158,.067,.022,.007],
  "W-3":[.936,.668,.311,.125,.046,.016],"W-2":[.97,.774,.519,.256,.123,.056],"W-1":[.989,.835,.643,.441,.259,.148],
  "E-16":[.015,.001,0,0,0,0],"E-15":[.038,.004,0,0,0,0],"E-14":[.093,.013,.002,0,0,0],"E-13":[.144,.024,.001,0,0,0],
  "E-12":[.177,.048,.004,.001,0,0],"E-11":[.258,.072,.018,.003,0,0],"E-10":[.296,.06,.015,.002,0,0],
  "E-9":[.318,.032,.009,.002,0,0],"E-8":[.682,.126,.058,.023,.007,.002],"E-7":[.704,.257,.106,.027,.008,.002],
  "E-6":[.742,.372,.185,.058,.021,.007],"E-5":[.823,.495,.147,.074,.026,.009],"E-4":[.856,.433,.111,.051,.017,.005],
  "E-3":[.907,.543,.285,.1,.038,.013],"E-2":[.962,.679,.39,.146,.06,.023],"E-1":[.985,.84,.669,.512,.33,.203],
};
// Round-by-round probabilities — EvanMiya model
const EM_ROUNDS = {
  "S-16":[.002,0,0,0,0,0],"S-15":[.006,.001,0,0,0,0],"S-14":[.009,.001,0,0,0,0],"S-13":[.121,.014,0,0,0,0],
  "S-12":[.143,.039,.002,0,0,0],"S-11":[.539,.086,.014,.003,0,0],"S-10":[.37,.042,.007,.001,.001,0],
  "S-9":[.596,.087,.037,.008,.001,0],"S-8":[.404,.049,.017,.003,.001,0],"S-7":[.63,.128,.041,.011,.002,.001],
  "S-6":[.461,.051,.006,.001,0,0],"S-5":[.857,.509,.152,.052,.016,.004],"S-4":[.879,.438,.122,.036,.009,.002],
  "S-3":[.991,.863,.386,.17,.07,.023],"S-2":[.995,.829,.546,.301,.153,.068],"S-1":[.998,.863,.669,.414,.228,.104],
  "MW-16":[.001,0,0,0,0,0],"MW-15":[.013,.001,0,0,0,0],"MW-14":[.047,.003,0,0,0,0],"MW-13":[.177,.064,.004,0,0,0],
  "MW-12":[.33,.082,.003,0,0,0],"MW-11":[.179,.041,.005,0,0,0],"MW-10":[.392,.062,.019,.002,0,0],
  "MW-9":[.489,.04,.019,.006,.001,0],"MW-8":[.511,.034,.016,.004,.001,0],"MW-7":[.608,.132,.05,.006,.001,0],
  "MW-6":[.821,.415,.163,.034,.009,.002],"MW-5":[.67,.291,.037,.01,.002,0],"MW-4":[.823,.563,.068,.021,.005,.001],
  "MW-3":[.953,.541,.226,.061,.02,.006],"MW-2":[.987,.806,.537,.185,.075,.028],"MW-1":[.999,.926,.853,.67,.435,.276],
  "W-16":[.006,.001,0,0,0,0],"W-15":[.003,0,0,0,0,0],"W-14":[.035,.004,0,0,0,0],"W-13":[.046,.009,0,0,0,0],
  "W-12":[.243,.031,.002,0,0,0],"W-11":[.518,.153,.033,.006,.001,0],"W-10":[.341,.031,.007,.001,0,0],
  "W-9":[.596,.071,.03,.009,.001,0],"W-8":[.404,.026,.007,.001,0,0],"W-7":[.66,.118,.044,.008,.001,0],
  "W-6":[.483,.131,.024,.003,.001,0],"W-5":[.757,.303,.059,.02,.004,.001],"W-4":[.955,.657,.158,.063,.016,.005],
  "W-3":[.965,.712,.278,.079,.016,.005],"W-2":[.997,.851,.614,.265,.111,.047],"W-1":[.994,.903,.746,.544,.299,.177],
  "E-16":[.004,.001,0,0,0,0],"E-15":[.036,.005,0,0,0,0],"E-14":[.062,.005,0,0,0,0],"E-13":[.078,.007,0,0,0,0],
  "E-12":[.14,.035,.002,0,0,0],"E-11":[.29,.088,.027,.003,.001,0],"E-10":[.262,.041,.008,.001,0,0],
  "E-9":[.356,.032,.01,.003,.001,0],"E-8":[.644,.083,.036,.014,.003,0],"E-7":[.738,.234,.082,.015,.003,.001],
  "E-6":[.71,.263,.108,.017,.003,.001],"E-5":[.86,.554,.156,.085,.03,.009],"E-4":[.922,.405,.079,.035,.01,.002],
  "E-3":[.938,.644,.366,.123,.047,.015],"E-2":[.964,.719,.409,.137,.052,.016],"E-1":[.996,.885,.716,.568,.369,.207],
};
// Avg cumulative Hogan payout per round reached (2023-2025 data)
const HOGAN_PAYOUT = [163, 958, 1931, 2911, 3916, 4483];
const HOGAN_INCR = HOGAN_PAYOUT.map((v, i) => i === 0 ? v : v - HOGAN_PAYOUT[i - 1]);
const ROUND_LABELS = ["R32","S16","E8","F4","F2","Ch"];

function getTeamValue(team) {
  const key = `${team.r}-${team.s}`;
  const tr = TORIK_ROUNDS[key] || [0,0,0,0,0,0];
  const em = EM_ROUNDS[key] || [0,0,0,0,0,0];
  const avg = tr.map((v, i) => (v + em[i]) / 2);
  // R64 payout for 1v16 and 2v15 is based on covering the spread, not just winning
  // Hogan 3yr ATS: 1s 11/12=92%, 2s 11/12=92%, 15s 4/12=35%, 16s 5/12=42%
  if (team.s <= 2) avg[0] = 0.92;
  else if (team.s >= 15) avg[0] = team.s === 16 ? 0.42 : 0.35;
  const roundEV = avg.map((p, i) => Math.round(p * HOGAN_INCR[i]));
  const fairValue = roundEV.reduce((a, b) => a + b, 0);
  const histAvg = HIST_AVG_PRICE[team.s] || 100;
  const ratio = fairValue / histAvg;
  let label, color;
  if (ratio >= 1.25) { label = "BUY"; color = "#2ecc71"; }
  else if (ratio >= 0.9) { label = "FAIR"; color = "#e9c46a"; }
  else if (ratio >= 0.6) { label = "MEH"; color = "#5a6a8a"; }
  else { label = "AVOID"; color = "#e63946"; }
  return { fairValue, label, color, roundEV, avg };
}


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
    const val = getTeamValue(team);
    const histAvg = HIST_AVG_PRICE[team.s] || 0;
    return (
      <div style={{ height: SLOT_H, display: 'flex', alignItems: 'center', padding: '0 4px', background: team.s <= 2 ? '#14203a' : '#0d1321', borderBottom: border ? '1px solid #1e2a40' : 'none', gap: 2 }}>
        <span style={{ width: 14, fontSize: 9, fontWeight: 700, textAlign: 'center', flexShrink: 0, color: team.s <= 2 ? '#4a9eff' : team.s <= 4 ? '#7c5cfc' : '#5a6a8a' }}>{team.s}</span>
        <span style={{ flex: 1, fontSize: 8, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c8d6e5' }}>{team.t}</span>
        <span style={{ fontSize: 6, flexShrink: 0, display: 'flex', gap: 1, alignItems: 'center' }}>
          <span style={{ color: val.color, fontWeight: 700 }}>${val.fairValue}</span>
          <span style={{ color: '#1e2a40' }}>/</span>
          <span style={{ color: '#3a4a6a' }}>${histAvg}</span>
        </span>
        <span style={{ fontSize: 6, flexShrink: 0, display: 'flex', gap: 1, alignItems: 'center', marginLeft: 1 }}>
          <span style={{ color: n >= 50 ? '#2ecc71' : n >= 25 ? '#e9c46a' : '#3a4a6a', fontWeight: 700 }}>{team.s16.replace('%','')}</span>
          <span style={{ color: '#1e2a40' }}>/</span>
          <span style={{ color: parseInt(team.tr) >= 50 ? '#7c5cfc' : '#3a4a6a' }}>{team.tr.replace('%','')}</span>
          <span style={{ color: '#1e2a40' }}>/</span>
          <span style={{ color: parseInt(team.em) >= 50 ? '#e9c46a' : '#3a4a6a' }}>{team.em.replace('%','')}</span>
        </span>
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
        <div style={{ fontSize: 8, textAlign: "center", padding: "4px 8px 2px", fontWeight: 600, color: "#7c5cfc" }}>
          ← Swipe / scroll sideways for full bracket →
        </div>
        <div style={{ fontSize: 7, textAlign: "center", padding: "0 8px 6px", display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <span>EV<span style={{ color: "#3a4a6a" }}>/</span>avg cost</span>
          <span style={{ color: "#3a4a6a" }}>│</span>
          <span>S16%: <span style={{ color: "#2ecc71" }}>DK</span><span style={{ color: "#3a4a6a" }}>/</span><span style={{ color: "#7c5cfc" }}>Torik</span><span style={{ color: "#3a4a6a" }}>/</span><span style={{ color: "#e9c46a" }}>EvMiya</span></span>
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
        {/* Seed Pricing Reference — fills empty bracket space */}
        <div style={{ padding: "10px 8px 4px", borderTop: "1px solid #1e2a40" }}>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1, color: "#4a6a8a", textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>
            Hogan Seed Prices '23-'25
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px 6px" }}>
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(s => {
              const [min, max, avg, med] = SEED_PRICES[s];
              const barMax = 3350;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    width: 16, fontSize: 8, fontWeight: 700, textAlign: "right", flexShrink: 0,
                    color: s <= 2 ? "#4a9eff" : s <= 4 ? "#7c5cfc" : "#5a6a8a",
                  }}>{s}</span>
                  <div style={{ flex: 1, position: "relative", height: 14 }}>
                    {/* Range bar (min to max) */}
                    <div style={{
                      position: "absolute", top: 6, height: 2, borderRadius: 1,
                      left: `${(min / barMax) * 100}%`,
                      width: `${((max - min) / barMax) * 100}%`,
                      background: "#1e2a40",
                    }} />
                    {/* Avg marker */}
                    <div style={{
                      position: "absolute", top: 3, width: 1, height: 8,
                      left: `${(avg / barMax) * 100}%`,
                      background: "#4a9eff",
                    }} />
                    {/* Median marker */}
                    <div style={{
                      position: "absolute", top: 4, width: 3, height: 6, borderRadius: 1,
                      left: `${(med / barMax) * 100}%`,
                      background: "#2ecc7199",
                    }} />
                    {/* Labels */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 6, color: "#3a4a6a" }}>${min}</span>
                      <span style={{ fontSize: 6, color: "#5a7a9a", fontWeight: 600 }}>${avg}</span>
                      <span style={{ fontSize: 6, color: "#3a4a6a" }}>${max}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4, fontSize: 6, color: "#3a4a6a" }}>
            <span><span style={{ display: "inline-block", width: 6, height: 2, background: "#1e2a40", borderRadius: 1, verticalAlign: "middle", marginRight: 2 }} />range</span>
            <span><span style={{ display: "inline-block", width: 1, height: 6, background: "#4a9eff", verticalAlign: "middle", marginRight: 2 }} />avg</span>
            <span><span style={{ display: "inline-block", width: 3, height: 4, background: "#2ecc7199", borderRadius: 1, verticalAlign: "middle", marginRight: 2 }} />median</span>
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
    if (num <= 700) return "Big Dog";
    if (num <= 2000) return "Contender";
    if (num <= 5000) return "Mid";
    if (num <= 10000) return "Long Shot";
    return "Lottery";
  };

  const tierColors = { "Big Dog": "#e63946", Contender: "#e9c46a", Mid: "#4a9eff", "Long Shot": "#7c5cfc", Lottery: "#3a4a6a" };

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
            }}>{m === "list" ? "📋 List (nerd shit)" : "🏆 Bracket"}</button>
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
          const val = getTeamValue(team);
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
                gap: 6,
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
                {/* Middle: S16 odds (3 sources) */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "baseline" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                        color: parseInt(team.s16) >= 50 ? "#2ecc71" : parseInt(team.s16) >= 25 ? "#2ecc71aa" : "#5a6a8a",
                      }}>{team.s16}</div>
                      <div style={{ fontSize: 6, color: "#3a4a6a" }}>DK</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                        color: parseInt(team.tr) >= 50 ? "#7c5cfc" : parseInt(team.tr) >= 25 ? "#7c5cfcaa" : "#4a5a7a",
                      }}>{team.tr}</div>
                      <div style={{ fontSize: 6, color: "#3a4a6a" }}>Torik</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                        color: parseInt(team.em) >= 50 ? "#e9c46a" : parseInt(team.em) >= 25 ? "#e9c46aaa" : "#4a5a7a",
                      }}>{team.em}</div>
                      <div style={{ fontSize: 6, color: "#3a4a6a" }}>EvMiya</div>
                    </div>
                  </div>
                </div>
                {/* Right: EV with round breakdown */}
                <div style={{ flexShrink: 0, minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 5 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                      color: val.color,
                    }}>{fmtDollar(val.fairValue)}</span>
                    <span style={{
                      fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                      background: `${val.color}22`, color: val.color, letterSpacing: 0.5,
                    }}>{val.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 1, justifyContent: "flex-end", marginTop: 3 }}>
                    {ROUND_LABELS.map((rl, ri) => {
                      const v = val.roundEV[ri];
                      const pct = val.fairValue > 0 ? v / val.fairValue : 0;
                      return (
                        <div key={rl} style={{ textAlign: "center", minWidth: 17 }}>
                          <div style={{
                            fontSize: 7, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                            color: v >= 100 ? "#8ab4c8" : v > 0 ? "#4a5a7a" : "#2a3548",
                          }}>{v > 0 ? `$${v}` : "–"}</div>
                          <div style={{
                            height: 2, borderRadius: 1, marginTop: 1,
                            background: v > 0 ? `rgba(74,158,255,${Math.min(pct * 3, 1)})` : "#1a2030",
                          }} />
                          <div style={{ fontSize: 5, color: "#3a4a6a", marginTop: 1 }}>{rl}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 7, color: "#3a4a6a", marginTop: 2, textAlign: "right" }}>{fmtDollar(histAvg)} hist avg</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 6, textAlign: "center" }}>
        Showing {filteredBracket.length} of 64 · S16%: <span style={{color:"#2ecc71"}}>DK</span> / <span style={{color:"#7c5cfc"}}>Torik</span> / <span style={{color:"#e9c46a"}}>EvMiya</span> · EV = round-by-round P(advance) × avg Hogan payout '23-'25
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
          S16%: <span style={{ color: "#2ecc71" }}>DK Implied</span> / <span style={{ color: "#7c5cfc" }}>Torik</span> / <span style={{ color: "#e9c46a" }}>EvanMiya</span>
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

      {/* Recommended Targets — driven by round-by-round EV vs historical cost */}
      <div style={{ marginTop: 24 }}>
        <SubTitle>Recommended Targets</SubTitle>
        <div style={{ fontSize: 9, color: "#5a6a8a", marginBottom: 10, lineHeight: 1.5 }}>
          EV = round-by-round P(advance) × avg Hogan payout per round ('23-'25). Ratio = EV ÷ historical avg cost.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #2ecc7133" }}>
            <div style={{ fontSize: 10, color: "#2ecc71", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>BUY — EV exceeds price by 25%+</div>
            {[
              { t: "Tennessee", s: "6MW", ev: "$680", hist: "$420", ratio: "1.62x", why: "Best value in the field. Models love deep run odds (40% S16, 17% E8). Lost 4 of 6 suppresses price" },
              { t: "Illinois", s: "3S", ev: "$1,512", hist: "$950", ratio: "1.59x", why: "Models avg 82% S16 — highest non-1-seed. E8 value ($392) is massive. Young, explosive O" },
              { t: "UCLA", s: "7E", ev: "$432", hist: "$290", ratio: "1.49x", why: "Both models have 24-26% S16 but deep run EV ($91 E8) is unusual for a 7-seed at this price" },
              { t: "St. John's", s: "5E", ev: "$812", hist: "$550", ratio: "1.48x", why: "BE champ. 50-55% S16 across models. $147 E8 value — 5-seeds dodge 1s until E8" },
              { t: "Vanderbilt", s: "5S", ev: "$802", hist: "$550", ratio: "1.46x", why: "Both models agree: ~51% S16. $170 E8 value. Beat Florida by 17. Expert sleeper" },
              { t: "Louisville", s: "6E", ev: "$564", hist: "$420", ratio: "1.34x", why: "37% S16 (Torik) with $143 E8 value. 6-seeds have +9% hist ROI. Brown injury = buy-low" },
              { t: "Michigan", s: "1MW", ev: "$2,657", hist: "$2,100", ratio: "1.27x", why: "31-3, #1 KenPom. Deepest EV profile: $739 E8 + $559 F4. Best 1-seed by model" },
              { t: "Arkansas", s: "4W", ev: "$855", hist: "$680", ratio: "1.26x", why: "Models avg 58% S16 — highest 4-seed. $154 E8 value from friendly bracket path" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 11 }}>{pick.ev}</span>
                    <span style={{ color: "#3a4a6a", fontSize: 9 }}>/ {pick.hist}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#2ecc7122", color: "#2ecc71" }}>{pick.ratio}</span>
                  </div>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #7c5cfc33" }}>
            <div style={{ fontSize: 10, color: "#7c5cfc", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Cinderella / Cheap Value</div>
            {[
              { t: "16-seed pkg", s: "all 16s", ev: "$68", hist: "$48", ratio: "1.42x", why: "42% ATS cover rate in Hogan (5/12). $68 EV at $48 cost = best ROI per dollar in the auction" },
              { t: "Iowa", s: "9S", ev: "$228", hist: "$200", ratio: "1.14x", why: "9-seeds are historically underpriced (+30% ROI). $81 S16 value + $41 E8. Underseeded per KenPom" },
              { t: "Texas", s: "11W", ev: "$229", hist: "$220", ratio: "1.04x", why: "Won First Four. 13-15% S16 across models. $112 S16 value at cheap 11-seed pricing" },
              { t: "Ohio State", s: "8E", ev: "$261", hist: "$250", ratio: "1.04x", why: "Models like them more than other 8s. $83 S16 + $46 E8 — rare deep value for an 8-seed" },
              { t: "Utah State", s: "9W", ev: "$207", hist: "$200", ratio: "1.03x", why: "MWC champ. 9-seeds at $200 are a sweet spot. $66 S16 + $34 E8 value" },
              { t: "Furman", s: "15E", ev: "$61", hist: "$72", ratio: "0.85x", why: "Best 15-seed by model. 35% ATS cover = $57 R64 value. If spread is generous, worth a flier" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ color: "#7c5cfc", fontWeight: 700, fontSize: 11 }}>{pick.ev}</span>
                    <span style={{ color: "#3a4a6a", fontSize: 9 }}>/ {pick.hist}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#7c5cfc22", color: "#7c5cfc" }}>{pick.ratio}</span>
                  </div>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Avoid list — EV well below historical cost */}
      <div style={{ marginTop: 14, background: "#111827", borderRadius: 8, padding: 12, border: "1px solid #e6394633" }}>
        <div style={{ fontSize: 10, color: "#e63946", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
          AVOID — EV well below price
        </div>
        <div style={{ fontSize: 9, color: "#4a5a7a", marginBottom: 8 }}>Teams where round-by-round EV is significantly less than what they'll cost. Only buy at a steep discount.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { t: "North Carolina 6S", ev: "$210", hist: "$420", ratio: "0.50x", why: "Wilson out (broken thumb). EV is HALF the typical cost. Hard avoid" },
            { t: "UConn 2E", ev: "$1,301", hist: "$1,550", ratio: "0.84x", why: "2x champ Hurley tax. Models coolest on this 2-seed — only 68-72% S16" },
            { t: "BYU 6W", ev: "$265", hist: "$420", ratio: "0.63x", why: "Dybantsa hype will inflate price. EV says $265, bidders will push past $400" },
            { t: "Saint Louis 9MW", ev: "$137", hist: "$200", ratio: "0.69x", why: "DK has 32% S16 but both models say 4-5%. Massive line discrepancy" },
            { t: "Any 12-seed over $100", ev: "$57-93", hist: "$200", ratio: "0.28-0.47x", why: "Worst EV tier. Even best 12 (Akron $93) is half the typical cost" },
            { t: "All 13-14 seeds", ev: "$7-64", hist: "$65-108", ratio: "0.11-0.59x", why: "Never justify the price. Hofstra ($64) is the only one close to breakeven" },
            { t: "Villanova 8W", ev: "$128", hist: "$250", ratio: "0.51x", why: "Both models under 7% S16. Back in tourney but not competitive at 8-seed cost" },
            { t: "Georgia 8MW", ev: "$160", hist: "$250", ratio: "0.64x", why: "315th pts allowed. 8-seeds are -39% ROI historically. $160 EV vs $250 cost" },
          ].map((fade, i) => (
            <div key={i} style={{ fontSize: 10, padding: "4px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#e63946", fontWeight: 600 }}>{fade.t}</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#e6394622", color: "#e63946" }}>{fade.ratio}</span>
              </div>
              <div style={{ color: "#4a5a7a", fontSize: 9, marginTop: 1 }}>EV {fade.ev} vs {fade.hist} avg — {fade.why}</div>
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