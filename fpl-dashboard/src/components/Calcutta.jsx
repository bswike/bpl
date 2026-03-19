import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════
// HOGAN CALCUTTA DATA (2022-2025)
// ═══════════════════════════════════════════

const SYNDICATES_2022 = [
  { name: "Curran", spent: 4520, totalWon: 5575, net: 1055, pct: 0.2334 },
  { name: "Bacon", spent: 4440, totalWon: 3097, net: -1343, pct: -0.3025 },
  { name: "Mustangs", spent: 4780, totalWon: 6659, net: 1879, pct: 0.3930 },
  { name: "Coach", spent: 3400, totalWon: 5265, net: 1865, pct: 0.5485 },
  { name: "Hogan", spent: 3660, totalWon: 2478, net: -1182, pct: -0.3230 },
  { name: "Hudachek", spent: 4760, totalWon: 3407, net: -1353, pct: -0.2842 },
  { name: "Smith", spent: 2970, totalWon: 1549, net: -1421, pct: -0.4785 },
  { name: "Crumbling", spent: 2440, totalWon: 2942, net: 502, pct: 0.2057 },
];

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
const TEAMS_2022 = [
  {s:"Curran",sd:"15W",t:"Cal St Fullerton",p:45,w:155,n:110,seed:15},
  {s:"Curran",sd:"15S",t:"Delaware",p:45,w:0,n:-45,seed:15},
  {s:"Curran",sd:"12E",t:"Indiana",p:150,w:0,n:-150,seed:12},
  {s:"Curran",sd:"9E",t:"Marquette",p:200,w:0,n:-200,seed:9},
  {s:"Curran",sd:"7E",t:"Murray St",p:260,w:155,n:-105,seed:7},
  {s:"Curran",sd:"6MW",t:"LSU",p:400,w:0,n:-400,seed:6},
  {s:"Curran",sd:"3W",t:"Texas Tech",p:1390,w:929,n:-461,seed:3},
  {s:"Curran",sd:"1MW",t:"Kansas",p:2030,w:4336,n:2306,seed:1},
  {s:"Bacon",sd:"11MW",t:"Iowa State",p:190,w:929,n:739,seed:11},
  {s:"Bacon",sd:"10E",t:"San Francisco",p:170,w:0,n:-170,seed:10},
  {s:"Bacon",sd:"10S",t:"Loyola Chicago",p:250,w:0,n:-250,seed:10},
  {s:"Bacon",sd:"8MW",t:"San Diego St",p:260,w:0,n:-260,seed:8},
  {s:"Bacon",sd:"8W",t:"Boise St",p:140,w:0,n:-140,seed:8},
  {s:"Bacon",sd:"6E",t:"Texas",p:310,w:155,n:-155,seed:6},
  {s:"Bacon",sd:"5S",t:"Houston",p:660,w:1858,n:1198,seed:5},
  {s:"Bacon",sd:"5MW",t:"Iowa",p:780,w:0,n:-780,seed:5},
  {s:"Bacon",sd:"1E",t:"Baylor",p:1680,w:155,n:-1525,seed:1},
  {s:"Coach",sd:"16W",t:"Georgia State",p:45,w:155,n:110,seed:16},
  {s:"Coach",sd:"16S",t:"Wright St",p:45,w:155,n:110,seed:16},
  {s:"Coach",sd:"16MW",t:"Texas So",p:45,w:0,n:-45,seed:16},
  {s:"Coach",sd:"16E",t:"Norfolk St",p:45,w:0,n:-45,seed:16},
  {s:"Coach",sd:"14W",t:"Montana St",p:40,w:0,n:-40,seed:14},
  {s:"Coach",sd:"13S",t:"Chattanooga",p:90,w:0,n:-90,seed:13},
  {s:"Coach",sd:"11E",t:"Virginia Tech",p:300,w:0,n:-300,seed:11},
  {s:"Coach",sd:"12S",t:"UAB",p:90,w:0,n:-90,seed:12},
  {s:"Coach",sd:"10W",t:"Davidson",p:270,w:0,n:-270,seed:10},
  {s:"Coach",sd:"8E",t:"UNC",p:280,w:3716,n:3436,seed:8},
  {s:"Coach",sd:"5E",t:"St Mary's",p:340,w:155,n:-185,seed:5},
  {s:"Coach",sd:"4MW",t:"Providence",p:540,w:929,n:389,seed:4},
  {s:"Coach",sd:"3S",t:"Tennessee",p:1270,w:155,n:-1115,seed:3},
  {s:"Hogan",sd:"14MW",t:"Colgate",p:110,w:0,n:-110,seed:14},
  {s:"Hogan",sd:"14S",t:"Longwood",p:50,w:0,n:-50,seed:14},
  {s:"Hogan",sd:"13E",t:"Akron",p:50,w:0,n:-50,seed:13},
  {s:"Hogan",sd:"12MW",t:"Richmond",p:110,w:155,n:45,seed:12},
  {s:"Hogan",sd:"11S",t:"Michigan",p:180,w:929,n:749,seed:11},
  {s:"Hogan",sd:"7W",t:"Michigan State",p:200,w:155,n:-45,seed:7},
  {s:"Hogan",sd:"4S",t:"Illinois",p:620,w:155,n:-465,seed:4},
  {s:"Hogan",sd:"3E",t:"Purdue",p:820,w:929,n:109,seed:3},
  {s:"Hogan",sd:"2MW",t:"Auburn",p:1520,w:155,n:-1365,seed:2},
  {s:"Hudachek",sd:"10MW",t:"Miami FL",p:300,w:1858,n:1558,seed:10},
  {s:"Hudachek",sd:"1S",t:"Arizona",p:2080,w:774,n:-1306,seed:1},
  {s:"Hudachek",sd:"1W",t:"Gonzaga",p:2380,w:774,n:-1606,seed:1},
  {s:"Smith",sd:"14E",t:"Yale",p:40,w:0,n:-40,seed:14},
  {s:"Smith",sd:"13MW",t:"South Dakota St",p:190,w:0,n:-190,seed:13},
  {s:"Smith",sd:"13W",t:"Vermont",p:160,w:0,n:-160,seed:13},
  {s:"Smith",sd:"12W",t:"New Mexico St",p:110,w:155,n:45,seed:12},
  {s:"Smith",sd:"9W",t:"Memphis",p:180,w:155,n:-25,seed:9},
  {s:"Smith",sd:"8S",t:"Seton Hall",p:150,w:0,n:-150,seed:8},
  {s:"Smith",sd:"7S",t:"Ohio State",p:200,w:155,n:-45,seed:7},
  {s:"Smith",sd:"6W",t:"Alabama",p:360,w:0,n:-360,seed:6},
  {s:"Smith",sd:"4E",t:"UCLA",p:900,w:929,n:29,seed:4},
  {s:"Smith",sd:"3MW",t:"Wisconsin",p:680,w:155,n:-525,seed:3},
  {s:"Crumbling",sd:"9MW",t:"Creighton",p:170,w:155,n:-15,seed:9},
  {s:"Crumbling",sd:"7MW",t:"USC",p:260,w:0,n:-260,seed:7},
  {s:"Crumbling",sd:"5W",t:"UConn",p:540,w:0,n:-540,seed:5},
  {s:"Crumbling",sd:"2S",t:"Villanova",p:1470,w:2787,n:1317,seed:2},
  {s:"Mustangs",sd:"15E",t:"Saint Pete",p:40,w:1858,n:1818,seed:15},
  {s:"Mustangs",sd:"15S",t:"Jax St",p:40,w:0,n:-40,seed:15},
  {s:"Mustangs",sd:"11W",t:"Notre Dame",p:160,w:155,n:-5,seed:11},
  {s:"Mustangs",sd:"9S",t:"TCU",p:180,w:155,n:-25,seed:9},
  {s:"Mustangs",sd:"6S",t:"Colorado State",p:280,w:0,n:-280,seed:6},
  {s:"Mustangs",sd:"4W",t:"Arkansas",p:740,w:1858,n:1118,seed:4},
  {s:"Mustangs",sd:"2E",t:"Kentucky",p:1660,w:0,n:-1660,seed:2},
  {s:"Mustangs",sd:"2W",t:"Duke",p:1680,w:2632,n:952,seed:2},
];

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

// 2026 AUCTION RESULTS — 9 syndicates, $37,750 pot
const SYNDICATES_2026 = [
  { name: "Bacon", spent: 5910, teams: 8 },
  { name: "Hogan", spent: 5720, teams: 10 },
  { name: "Hudachek", spent: 5090, teams: 3 },
  { name: "Tomek", spent: 4660, teams: 15 },
  { name: "Curran", spent: 4460, teams: 6 },
  { name: "Stangs", spent: 3610, teams: 8 },
  { name: "Crumbling", spent: 2890, teams: 5 },
  { name: "Smith", spent: 2720, teams: 5 },
  { name: "Coach", spent: 2690, teams: 4 },
];

const TEAMS_2026 = [
  {s:"Tomek",sd:"S-16",t:"Lehigh/PVAMU",p:45,seed:16,spread:35,w:0,n:0,alive:true,ats:null},
  {s:"Tomek",sd:"MW-16",t:"Howard",p:45,seed:16,spread:30.5,w:0,n:0,alive:true,ats:null},
  {s:"Tomek",sd:"W-16",t:"Long Island",p:45,seed:16,spread:30.5,w:0,n:0,alive:true,ats:null},
  {s:"Tomek",sd:"E-16",t:"Siena",p:45,seed:16,spread:27.5,w:0,n:0,alive:true,ats:null},
  {s:"Tomek",sd:"S-15",t:"Idaho",p:90,seed:15,spread:23.5,w:0,n:0,alive:true,ats:null},
  {s:"Tomek",sd:"MW-15",t:"TN State",p:90,seed:15,spread:24.5,w:0,n:0,alive:true,ats:null},
  {s:"Coach",sd:"W-15",t:"Queens",p:60,seed:15,spread:25.5,w:0,n:0,alive:true,ats:null},
  {s:"Coach",sd:"E-15",t:"Furman",p:60,seed:15,spread:20.5,w:0,n:0,alive:true,ats:null},
  {s:"Hogan",sd:"S-14",t:"Penn",p:20,seed:14,w:0,n:0,alive:true},
  {s:"Smith",sd:"MW-14",t:"Wright State",p:40,seed:14,w:0,n:0,alive:true},
  {s:"Hogan",sd:"W-14",t:"Kennesaw St",p:40,seed:14,w:0,n:0,alive:true},
  {s:"Tomek",sd:"E-14",t:"ND State",p:20,seed:14,w:0,n:0,alive:true},
  {s:"Tomek",sd:"S-13",t:"Troy",p:80,seed:13,w:0,n:0,alive:true},
  {s:"Hogan",sd:"MW-13",t:"Hofstra",p:80,seed:13,w:0,n:0,alive:true},
  {s:"Stangs",sd:"W-13",t:"Hawaii",p:40,seed:13,w:0,n:0,alive:true},
  {s:"Stangs",sd:"E-13",t:"Cal Baptist",p:60,seed:13,w:0,n:0,alive:true},
  {s:"Crumbling",sd:"S-12",t:"McNeese",p:80,seed:12,w:0,n:0,alive:true},
  {s:"Hogan",sd:"MW-12",t:"Akron",p:120,seed:12,w:0,n:0,alive:true},
  {s:"Tomek",sd:"W-12",t:"High Point",p:140,seed:12,w:0,n:0,alive:true},
  {s:"Stangs",sd:"E-12",t:"Northern Iowa",p:100,seed:12,w:0,n:0,alive:true},
  {s:"Bacon",sd:"S-11",t:"VCU",p:160,seed:11,w:0,n:0,alive:true},
  {s:"Tomek",sd:"MW-11",t:"Miami (OH)",p:120,seed:11,w:0,n:0,alive:true},
  {s:"Bacon",sd:"W-11",t:"Texas",p:260,seed:11,w:0,n:0,alive:true},
  {s:"Tomek",sd:"E-11",t:"South Florida",p:200,seed:11,w:0,n:0,alive:true},
  {s:"Stangs",sd:"S-10",t:"Texas A&M",p:120,seed:10,w:0,n:0,alive:true},
  {s:"Smith",sd:"MW-10",t:"Santa Clara",p:180,seed:10,w:0,n:0,alive:true},
  {s:"Curran",sd:"W-10",t:"Missouri",p:180,seed:10,w:0,n:0,alive:true},
  {s:"Hogan",sd:"E-10",t:"UCF",p:160,seed:10,w:0,n:0,alive:true},
  {s:"Bacon",sd:"S-9",t:"Iowa",p:200,seed:9,w:0,n:0,alive:true},
  {s:"Stangs",sd:"MW-9",t:"Saint Louis",p:140,seed:9,w:0,n:0,alive:true},
  {s:"Bacon",sd:"W-9",t:"Utah State",p:160,seed:9,w:0,n:0,alive:true},
  {s:"Smith",sd:"E-9",t:"TCU",p:160,seed:9,w:0,n:0,alive:true},
  {s:"Tomek",sd:"S-8",t:"Clemson",p:140,seed:8,w:0,n:0,alive:true},
  {s:"Smith",sd:"MW-8",t:"Georgia",p:140,seed:8,w:0,n:0,alive:true},
  {s:"Hogan",sd:"W-8",t:"Villanova",p:200,seed:8,w:0,n:0,alive:true},
  {s:"Curran",sd:"E-8",t:"Ohio State",p:240,seed:8,w:0,n:0,alive:true},
  {s:"Hudachek",sd:"S-7",t:"Saint Mary's",p:240,seed:7,w:0,n:0,alive:true},
  {s:"Curran",sd:"MW-7",t:"Kentucky",p:320,seed:7,w:0,n:0,alive:true},
  {s:"Hogan",sd:"W-7",t:"Miami FL",p:300,seed:7,w:0,n:0,alive:true},
  {s:"Curran",sd:"E-7",t:"UCLA",p:520,seed:7,w:0,n:0,alive:true},
  {s:"Crumbling",sd:"S-6",t:"North Carolina",p:320,seed:6,w:0,n:0,alive:true},
  {s:"Bacon",sd:"MW-6",t:"Tennessee",p:660,seed:6,w:0,n:0,alive:true},
  {s:"Crumbling",sd:"W-6",t:"BYU",p:480,seed:6,w:0,n:0,alive:true},
  {s:"Bacon",sd:"E-6",t:"Louisville",p:420,seed:6,w:0,n:0,alive:true},
  {s:"Tomek",sd:"S-5",t:"Vanderbilt",p:1000,seed:5,w:0,n:0,alive:true},
  {s:"Crumbling",sd:"MW-5",t:"Texas Tech",p:460,seed:5,w:0,n:0,alive:true},
  {s:"Curran",sd:"W-5",t:"Wisconsin",p:500,seed:5,w:0,n:0,alive:true},
  {s:"Stangs",sd:"E-5",t:"St. John's",p:900,seed:5,w:0,n:0,alive:true},
  {s:"Coach",sd:"S-4",t:"Nebraska",p:520,seed:4,w:0,n:0,alive:true},
  {s:"Tomek",sd:"MW-4",t:"Alabama",p:600,seed:4,w:0,n:0,alive:true},
  {s:"Hogan",sd:"W-4",t:"Arkansas",p:800,seed:4,w:0,n:0,alive:true},
  {s:"Stangs",sd:"E-4",t:"Kansas",p:950,seed:4,w:0,n:0,alive:true},
  {s:"Stangs",sd:"S-3",t:"Illinois",p:1300,seed:3,w:0,n:0,alive:true},
  {s:"Bacon",sd:"MW-3",t:"Virginia",p:1100,seed:3,w:0,n:0,alive:true},
  {s:"Hogan",sd:"W-3",t:"Gonzaga",p:1000,seed:3,w:0,n:0,alive:true},
  {s:"Crumbling",sd:"E-3",t:"Michigan State",p:1550,seed:3,w:0,n:0,alive:true},
  {s:"Smith",sd:"S-2",t:"Houston",p:2200,seed:2,w:0,n:0,alive:true,ats:null},
  {s:"Coach",sd:"MW-2",t:"Iowa State",p:2050,seed:2,w:0,n:0,alive:true,ats:null},
  {s:"Tomek",sd:"W-2",t:"Purdue",p:2000,seed:2,w:0,n:0,alive:true,ats:null},
  {s:"Hudachek",sd:"E-2",t:"UConn",p:1650,seed:2,w:0,n:0,alive:true,ats:null},
  {s:"Curran",sd:"S-1",t:"Florida",p:2700,seed:1,w:0,n:0,alive:true,ats:null},
  {s:"Hogan",sd:"MW-1",t:"Michigan",p:3000,seed:1,w:0,n:0,alive:true,ats:null},
  {s:"Hudachek",sd:"W-1",t:"Arizona",p:3200,seed:1,w:0,n:0,alive:true,ats:null},
  {s:"Bacon",sd:"E-1",t:"Duke",p:2950,seed:1,w:0,n:0,alive:true,ats:null},
];

const R64_GAMES = {
  "S-1v16":  { time: "Fri 9:25p", spread: "FL -35" },
  "S-8v9":   { time: "Fri 6:50p", spread: "IOWA -2.5" },
  "S-5v12":  { time: "Thu 3:15p", spread: "VAN -11.5" },
  "S-4v13":  { time: "Thu 12:40p", spread: "NEB -13.5" },
  "S-6v11":  { time: "Thu 6:50p", spread: "UNC -2.5" },
  "S-3v14":  { time: "Thu 9:25p", spread: "ILL -21.5" },
  "S-7v10":  { time: "Thu 7:35p", spread: "SMC -2.5" },
  "S-2v15":  { time: "Thu 10:10p", spread: "HOU -23.5" },
  "MW-1v16": { time: "Thu 7:10p", spread: "MICH -30.5" },
  "MW-8v9":  { time: "Thu 9:45p", spread: "UGA -1.5" },
  "MW-5v12": { time: "Fri 12:40p", spread: "TTU -8.5" },
  "MW-4v13": { time: "Fri 3:15p", spread: "BAMA -12.5" },
  "MW-6v11": { time: "Fri 4:25p", spread: "TENN -10.5" },
  "MW-3v14": { time: "Fri 1:50p", spread: "UVA -17.5" },
  "MW-7v10": { time: "Fri 12:15p", spread: "UK -3.5" },
  "MW-2v15": { time: "Fri 2:50p", spread: "ISU -24.5" },
  "W-1v16":  { time: "Fri 1:35p", spread: "ARIZ -30.5" },
  "W-8v9":   { time: "Fri 4:10p", spread: "USU -1.5" },
  "W-5v12":  { time: "Thu 1:50p", spread: "WIS -11.5" },
  "W-4v13":  { time: "Thu 4:25p", spread: "ARK -15.5" },
  "W-6v11":  { time: "Thu 7:25p", spread: "BYU -2.5" },
  "W-3v14":  { time: "Thu 10:00p", spread: "GONZ -18.5" },
  "W-7v10":  { time: "Fri 10:10p", spread: "MIA -1.5" },
  "W-2v15":  { time: "Fri 7:35p", spread: "PUR -25.5" },
  "E-1v16":  { time: "Thu 2:50p", spread: "DUKE -27.5" },
  "E-8v9":   { time: "Thu 12:15p", spread: "OSU -2.5" },
  "E-5v12":  { time: "Fri 7:10p", spread: "SJU -9.5" },
  "E-4v13":  { time: "Fri 9:45p", spread: "KU -13.5" },
  "E-6v11":  { time: "Thu 1:30p", spread: "LOU -6.5" },
  "E-3v14":  { time: "Thu 4:05p", spread: "MSU -16.5" },
  "E-7v10":  { time: "Fri 7:25p", spread: "UCLA -5.5" },
  "E-2v15":  { time: "Fri 10:00p", spread: "UCONN -20.5" },
};

const POT_2026 = 37750;
const PAYOUT_2026 = {
  R32: Math.round(POT_2026 * 0.005 * 100) / 100,
  S16: Math.round(POT_2026 * 0.03 * 100) / 100,
  E8: Math.round(POT_2026 * 0.06 * 100) / 100,
  F4: Math.round(POT_2026 * 0.09 * 100) / 100,
  F2: Math.round(POT_2026 * 0.12 * 100) / 100,
  Ch: Math.round(POT_2026 * 0.14 * 100) / 100,
};

const ALL_TEAMS = [
  ...TEAMS_2022.map(t => ({...t, year: 2022})),
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
  Mustangs: "#3a86c8",
  Stangs: "#3a86c8",
  Smith: "#50c878",
  Tomek: "#ff6b35",
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
  {r:"MW",s:11,t:"Miami (OH)",odds:"+20000",s16:"15%",tr:"5%",em:"3%",note:"First Four Wed"},
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

const HIST_AVG_PRICE = {16:50,15:65,14:61,13:113,12:189,11:213,10:237,9:201,8:236,7:263,6:388,5:564,4:709,3:1011,2:1573,1:2059};
const HIST_ROI = {16:0.36,15:2.31,14:-0.82,13:-0.81,12:-0.68,11:0.72,10:-0.13,9:0.33,8:0.41,7:-0.39,6:0.05,5:0.36,4:0.56,3:-0.17,2:-0.24,1:-0.01};
// Seed pricing stats from 2022-2025 Hogan data: [min, max, avg, median]
const SEED_PRICES = {
  1:[1200,3350,2059,1965],2:[1200,2150,1573,1550],3:[680,1400,1011,1025],4:[480,1020,709,665],
  5:[240,1000,564,545],6:[220,740,388,370],7:[150,400,263,255],8:[140,400,236,210],
  9:[140,320,201,180],10:[140,340,237,235],11:[140,360,213,195],12:[90,270,189,200],
  13:[50,220,113,95],14:[40,110,61,60],15:[40,80,65,70],16:[45,60,50,48],
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
// Avg cumulative Hogan payout per round reached (2022-2025 data)
const HOGAN_PAYOUT = [161, 951, 1913, 2880, 3866, 4446];
const HOGAN_INCR_BASE = HOGAN_PAYOUT.map((v, i) => i === 0 ? v : v - HOGAN_PAYOUT[i - 1]);
const ROUND_LABELS = ["R32","S16","E8","F4","F2","Ch"];

// 9-syndicate adjustment: 2026 has 9 syndicates again (like 2024)
// EV scales with pot: 9-syn pot ($35.5K) / 4yr avg pot ($31.7K) = 1.12x
const EV_SCALE_9SYN = 1.1189;
const HOGAN_INCR = HOGAN_INCR_BASE.map(v => Math.round(v * EV_SCALE_9SYN));
// Expected cost per seed in 9-syn auction: 8-syn baseline (2022+2023+2025) × dampened premium
// Premium = 2024 observed / 8-syn avg, dampened to 70% since 2024 is a single data point
const ADJ_9SYN_PRICE = {1:2376,2:1724,3:1087,4:748,5:523,6:350,7:282,8:226,9:223,10:245,11:223,12:203,13:95,14:62,15:73,16:56};

const PAYOUT_2026_CUM = [0.005, 0.03, 0.06, 0.09, 0.12, 0.14];
const PAYOUT_2026_INCR = PAYOUT_2026_CUM.map((v, i) => Math.round((i === 0 ? v : v - PAYOUT_2026_CUM[i - 1]) * POT_2026));

function getTeamValueLive2026(team, price) {
  const key = `${team.r}-${team.s}`;
  const tr = TORIK_ROUNDS[key] || [0,0,0,0,0,0];
  const em = EM_ROUNDS[key] || [0,0,0,0,0,0];
  const avg = tr.map((v, i) => (v + em[i]) / 2);
  if (team.s === 1) avg[0] = 0.75;
  else if (team.s === 2) avg[0] = 0.78;
  else if (team.s >= 15) avg[0] = team.s === 16 ? 0.42 : 0.35;
  const roundEV = avg.map((p, i) => Math.round(p * PAYOUT_2026_INCR[i]));
  const fairValue = roundEV.reduce((a, b) => a + b, 0);
  const ratio = price > 0 ? fairValue / price : 0;
  let label, color;
  if (ratio >= 1.25) { label = "BUY"; color = "#2ecc71"; }
  else if (ratio >= 0.9) { label = "FAIR"; color = "#e9c46a"; }
  else if (ratio >= 0.6) { label = "MEH"; color = "#5a6a8a"; }
  else { label = "AVOID"; color = "#e63946"; }
  return { fairValue, label, color, roundEV, avg };
}

function getTeamValue(team) {
  const key = `${team.r}-${team.s}`;
  const tr = TORIK_ROUNDS[key] || [0,0,0,0,0,0];
  const em = EM_ROUNDS[key] || [0,0,0,0,0,0];
  const avg = tr.map((v, i) => (v + em[i]) / 2);
  // R64 payout for 1v16 and 2v15 is ATS (cover the spread), not just winning
  if (team.s === 1) avg[0] = 0.75;
  else if (team.s === 2) avg[0] = 0.78;
  else if (team.s >= 15) avg[0] = team.s === 16 ? 0.42 : 0.35;
  const roundEV = avg.map((p, i) => Math.round(p * HOGAN_INCR[i]));
  const fairValue = roundEV.reduce((a, b) => a + b, 0);
  const expectedCost = ADJ_9SYN_PRICE[team.s] || 100;
  const ratio = fairValue / expectedCost;
  let label, color;
  if (ratio >= 1.25) { label = "BUY"; color = "#2ecc71"; }
  else if (ratio >= 0.9) { label = "FAIR"; color = "#e9c46a"; }
  else if (ratio >= 0.6) { label = "MEH"; color = "#5a6a8a"; }
  else { label = "AVOID"; color = "#e63946"; }
  return { fairValue, label, color, roundEV, avg, expectedCost };
}


const HIST_TABS_MAIN = ["Leaderboard", "Teams", "Seed ROI", "Spending"];
const HIST_TABS_EXTRA = ["2026 Prep", "Strategy"];

export default function App() {
  const [activeTab, setActiveTab] = useState("2026 Live");
  const [histTab, setHistTab] = useState("Leaderboard");
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
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#3a4a6a", fontWeight: 500 }}>HOGAN CALCUTTA 2026</div>
      </div>

      {/* Top-level nav */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
        {activeTab === "Historical" ? (
          <button onClick={() => setActiveTab("2026 Live")} style={{
            padding: "10px 32px", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
            background: "linear-gradient(135deg, #4a9eff22, #7c5cfc22)",
            border: "1px solid #4a9eff", borderRadius: 6, color: "#4a9eff",
            cursor: "pointer", letterSpacing: 1,
          }}>← Back to 2026 Live</button>
        ) : (
          <button onClick={() => setActiveTab("Historical")} style={{
            padding: 0, fontFamily: "inherit", fontSize: 10, fontWeight: 400,
            background: "transparent", border: "none", color: "#3a4a6a",
            cursor: "pointer", letterSpacing: 0.5,
            borderBottom: "1px dashed #2a3a5a",
          }}>Historical Data →</button>
        )}
      </div>

      {activeTab === "2026 Live" && <Live2026 />}

      {activeTab === "Historical" && (
        <div>
          {/* Historical sub-tabs — main */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            {HIST_TABS_MAIN.map(tab => (
              <button key={tab} onClick={() => setHistTab(tab)} style={{
                padding: "7px 16px",
                background: histTab === tab ? "linear-gradient(135deg, #4a9eff15, #7c5cfc15)" : "transparent",
                border: `1px solid ${histTab === tab ? "#4a9eff88" : "#1e2a40"}`,
                borderRadius: 5, color: histTab === tab ? "#4a9eff" : "#5a6a8a",
                fontFamily: "inherit", fontSize: 11, fontWeight: histTab === tab ? 700 : 400,
                cursor: "pointer", letterSpacing: 0.5, transition: "all 0.2s",
              }}>{tab}</button>
            ))}
          </div>
          {/* Historical sub-tabs — extra (minimized) */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 14 }}>
            {HIST_TABS_EXTRA.map(tab => (
              <button key={tab} onClick={() => setHistTab(tab)} style={{
                padding: "2px 8px", background: "transparent", border: "none",
                borderBottom: histTab === tab ? "1px solid #4a9eff" : "1px solid transparent",
                color: histTab === tab ? "#4a9eff" : "#2a3a5a",
                fontFamily: "inherit", fontSize: 9, fontWeight: histTab === tab ? 600 : 400,
                cursor: "pointer", letterSpacing: 0.5,
              }}>{tab}</button>
            ))}
          </div>

          {/* Year filter — hide for Prep and Spending */}
          {histTab !== "2026 Prep" && histTab !== "Spending" && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: 4,
              marginBottom: 24,
            }}>
              {["All", "2022", "2023", "2024", "2025"].map(y => (
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

          {histTab === "2026 Prep" && <AuctionPrep />}
          {histTab === "Leaderboard" && <Leaderboard year={selectedYear} />}
          {histTab === "Seed ROI" && <SeedROI year={selectedYear} />}
          {histTab === "Strategy" && <Strategy year={selectedYear} />}
          {histTab === "Teams" && <TeamExplorer year={selectedYear} />}
          {histTab === "Spending" && <SpendingAnalysis />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════

function Leaderboard({ year }) {
  const data = useMemo(() => {
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
    const allSyns = { 2022: SYNDICATES_2022, 2023: SYNDICATES_2023, 2024: SYNDICATES_2024, 2025: SYNDICATES_2025 };

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
                  {[2022, 2023, 2024, 2025].map(y => {
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
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
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
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
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
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
    const allSyns = { 2022: SYNDICATES_2022, 2023: SYNDICATES_2023, 2024: SYNDICATES_2024, 2025: SYNDICATES_2025 };

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
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
    const allTeamSets = { 2022: TEAMS_2022, 2023: TEAMS_2023, 2024: TEAMS_2024, 2025: TEAMS_2025 };

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
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
    return ALL_TEAMS
      .filter(t => years.includes(t.year))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [year]);

  const worstPicks = useMemo(() => {
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
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
        <SectionTitle>🎯 Actionable Rules (2022-2025 Data)</SectionTitle>
        
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
        <SectionTitle>Hogan Calcutta Intelligence (4-Year Analysis)</SectionTitle>

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
              <div style={{ fontSize: 9, color: "#5a6a8a" }}>4yr avg ROI</div>
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
    const years = year === "All" ? [2022, 2023, 2024, 2025] : [parseInt(year)];
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
    return (
      <div style={{ height: SLOT_H, display: 'flex', alignItems: 'center', padding: '0 4px', background: team.s <= 2 ? '#14203a' : '#0d1321', borderBottom: border ? '1px solid #1e2a40' : 'none', gap: 2 }}>
        <span style={{ width: 14, fontSize: 9, fontWeight: 700, textAlign: 'center', flexShrink: 0, color: team.s <= 2 ? '#4a9eff' : team.s <= 4 ? '#7c5cfc' : '#5a6a8a' }}>{team.s}</span>
        <span style={{ flex: 1, fontSize: 8, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c8d6e5' }}>{team.t}</span>
        <span style={{ fontSize: 6, flexShrink: 0, display: 'flex', gap: 1, alignItems: 'center' }}>
          <span style={{ color: val.color, fontWeight: 700 }}>${val.fairValue}</span>
          <span style={{ color: '#1e2a40' }}>/</span>
          <span style={{ color: '#3a4a6a' }}>${val.expectedCost}</span>
        </span>
        {(() => {
          const avg3 = Math.round(((parseInt(team.s16)||0) + (parseInt(team.tr)||0) + (parseInt(team.em)||0)) / 3);
          return <span style={{ fontSize: 7, flexShrink: 0, fontWeight: 700, marginLeft: 1, color: avg3 >= 50 ? '#2ecc71' : avg3 >= 25 ? '#e9c46a' : '#3a4a6a' }}>{avg3}%</span>;
        })()}
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
          <span>EV<span style={{ color: "#3a4a6a" }}>/</span>exp cost (9-syn)</span>
          <span style={{ color: "#3a4a6a" }}>│</span>
          <span>S16% avg (DK + Torik + EvMiya)</span>
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
        {/* Seed Pricing Reference */}
        <div style={{ padding: "10px 8px 6px", borderTop: "1px solid #1e2a40" }}>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1, color: "#4a6a8a", textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>
            Hogan Seed Prices '22-'25
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2a40" }}>
                {["Seed","Low","High","Avg","Med"].map(h => (
                  <th key={h} style={{ padding: "2px 3px", fontWeight: 600, color: "#4a6a8a", textAlign: h === "Seed" ? "center" : "right", fontSize: 7 }}>{h}</th>
                ))}
                {["Seed","Low","High","Avg","Med"].map(h => (
                  <th key={h+"b"} style={{ padding: "2px 3px", fontWeight: 600, color: "#4a6a8a", textAlign: h === "Seed" ? "center" : "right", fontSize: 7, borderLeft: h === "Seed" ? "1px solid #1e2a40" : "none" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0,1,2,3,4,5,6,7].map(i => {
                const sL = i + 1;
                const sR = i + 9;
                const [minL,maxL,avgL,medL] = SEED_PRICES[sL];
                const [minR,maxR,avgR,medR] = SEED_PRICES[sR];
                const sc = (s) => s <= 2 ? "#4a9eff" : s <= 4 ? "#7c5cfc" : "#5a6a8a";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #0d1321" }}>
                    <td style={{ padding: "2px 3px", textAlign: "center", fontWeight: 700, color: sc(sL) }}>{sL}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#3a4a6a" }}>${minL}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#3a4a6a" }}>${maxL.toLocaleString()}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#7c9aaa", fontWeight: 600 }}>${avgL.toLocaleString()}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#5a7a8a" }}>${medL.toLocaleString()}</td>
                    <td style={{ padding: "2px 3px", textAlign: "center", fontWeight: 700, color: sc(sR), borderLeft: "1px solid #1e2a40" }}>{sR}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#3a4a6a" }}>${minR}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#3a4a6a" }}>${maxR}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#7c9aaa", fontWeight: 600 }}>${avgR}</td>
                    <td style={{ padding: "2px 3px", textAlign: "right", color: "#5a7a8a" }}>${medR}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                  <div style={{ fontSize: 7, color: "#3a4a6a", marginTop: 2, textAlign: "right" }}>{fmtDollar(val.expectedCost)} exp cost</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#3a4a6a", marginTop: 6, textAlign: "center" }}>
        Showing {filteredBracket.length} of 64 · S16%: <span style={{color:"#2ecc71"}}>DK</span> / <span style={{color:"#7c5cfc"}}>Torik</span> / <span style={{color:"#e9c46a"}}>EvMiya</span> · EV = P(advance) × Hogan payout, scaled for 9-syn pot
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

      {/* Recommended Targets — driven by round-by-round EV vs 9-syn expected cost */}
      <div style={{ marginTop: 24 }}>
        <SubTitle>Recommended Targets</SubTitle>
        <div style={{ fontSize: 9, color: "#5a6a8a", marginBottom: 10, lineHeight: 1.5 }}>
          EV = round-by-round P(advance) × Hogan payout (scaled 1.11x for 9-syn pot). Ratio = EV ÷ expected 9-syn cost per seed.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          <div style={{ background: "#111827", borderRadius: 8, padding: 14, border: "1px solid #2ecc7133" }}>
            <div style={{ fontSize: 10, color: "#2ecc71", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>BUY — EV exceeds price by 25%+</div>
            {[
              { t: "Tennessee", s: "6MW", ev: "$753", cost: "$350", ratio: "2.15x", why: "Best value in the field. Models love deep run odds (40% S16, 17% E8). Lost 4 of 6 suppresses price" },
              { t: "Louisville", s: "6E", ev: "$627", cost: "$350", ratio: "1.79x", why: "37% S16 (Torik) with deep E8 value. 6-seeds have +5% hist ROI. Brown injury = buy-low" },
              { t: "St. John's", s: "5E", ev: "$901", cost: "$523", ratio: "1.72x", why: "BE champ. 50-55% S16 across models. 5-seeds dodge 1s until E8 — great bracket path" },
              { t: "Vanderbilt", s: "5S", ev: "$889", cost: "$523", ratio: "1.70x", why: "Both models agree: ~51% S16. Beat Florida by 17. Expert sleeper at deflated 5-seed cost" },
              { t: "UCLA", s: "7E", ev: "$478", cost: "$282", ratio: "1.70x", why: "Both models have 24-26% S16 but deep run EV is unusual for a 7-seed at this price" },
              { t: "Illinois", s: "3S", ev: "$1,676", cost: "$1,087", ratio: "1.54x", why: "Models avg 82% S16 — highest non-1-seed. E8 value is massive. Young, explosive O" },
              { t: "Arkansas", s: "4W", ev: "$947", cost: "$748", ratio: "1.27x", why: "Models avg 58% S16 — highest 4-seed. Friendly bracket path boosts deep round value" },
              { t: "Michigan", s: "1MW", ev: "$2,913", cost: "$2,376", ratio: "1.23x", why: "31-3, #1 KenPom. Deepest EV profile of any team. Best 1-seed by model — but 9-syn price is steep" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 11 }}>{pick.ev}</span>
                    <span style={{ color: "#3a4a6a", fontSize: 9 }}>/ {pick.cost}</span>
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
              { t: "16-seed pkg", s: "all 16s", ev: "$76", cost: "$56", ratio: "1.36x", why: "42% ATS cover rate in Hogan (5/12). $76 EV at $56 cost = best ROI per dollar in the auction" },
              { t: "Ohio State", s: "8E", ev: "$289", cost: "$226", ratio: "1.28x", why: "Models like them more than other 8s. Rare deep value for an 8-seed at deflated 9-syn price" },
              { t: "Iowa", s: "9S", ev: "$253", cost: "$223", ratio: "1.13x", why: "9-seeds are historically underpriced (+33% ROI). Underseeded per KenPom" },
              { t: "Texas", s: "11W", ev: "$252", cost: "$223", ratio: "1.13x", why: "Won First Four. 13-15% S16 across models. S16 value at cheap 11-seed pricing" },
              { t: "Utah State", s: "9W", ev: "$230", cost: "$223", ratio: "1.03x", why: "MWC champ. 9-seeds at this price are a sweet spot in 9-syn auctions" },
              { t: "Furman", s: "15E", ev: "$67", cost: "$73", ratio: "0.92x", why: "Best 15-seed by model. 35% ATS cover = $63 R64 value. If spread is generous, worth a flier" },
            ].map((pick, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1a1f2e", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{pick.t} <span style={{ color: "#4a6a8a", fontSize: 9 }}>({pick.s})</span></span>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ color: "#7c5cfc", fontWeight: 700, fontSize: 11 }}>{pick.ev}</span>
                    <span style={{ color: "#3a4a6a", fontSize: 9 }}>/ {pick.cost}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#7c5cfc22", color: "#7c5cfc" }}>{pick.ratio}</span>
                  </div>
                </div>
                <div style={{ color: "#5a6a8a", fontSize: 9, marginTop: 2 }}>{pick.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Avoid list — EV well below expected cost */}
      <div style={{ marginTop: 14, background: "#111827", borderRadius: 8, padding: 12, border: "1px solid #e6394633" }}>
        <div style={{ fontSize: 10, color: "#e63946", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
          AVOID — EV well below price
        </div>
        <div style={{ fontSize: 9, color: "#4a5a7a", marginBottom: 8 }}>Teams where round-by-round EV is significantly less than what they'll cost. Only buy at a steep discount.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { t: "North Carolina 6S", ev: "$234", cost: "$350", ratio: "0.67x", why: "Wilson out (broken thumb). EV is well below even the deflated 9-syn 6-seed cost" },
            { t: "UConn 2E", ev: "$1,416", cost: "$1,724", ratio: "0.82x", why: "2x champ Hurley tax. Models coolest on this 2-seed — only 68-72% S16" },
            { t: "BYU 6W", ev: "$294", cost: "$350", ratio: "0.84x", why: "Dybantsa hype will inflate price past $400. EV says $294 — let someone else overpay" },
            { t: "Saint Louis 9MW", ev: "$152", cost: "$223", ratio: "0.68x", why: "DK has 32% S16 but both models say 4-5%. Massive line discrepancy" },
            { t: "Any 12-seed over $100", ev: "$57-93", cost: "$203", ratio: "0.28-0.46x", why: "Worst EV tier. Even best 12 (Akron $93) is half the expected cost" },
            { t: "All 13-14 seeds", ev: "$7-64", cost: "$62-95", ratio: "0.11-0.67x", why: "Never justify the price. Hofstra ($64) is the only one close to breakeven" },
            { t: "Villanova 8W", ev: "$142", cost: "$226", ratio: "0.63x", why: "Both models under 7% S16. Back in tourney but not competitive at 8-seed cost" },
            { t: "Georgia 8MW", ev: "$176", cost: "$226", ratio: "0.78x", why: "315th pts allowed. 8-seeds are +41% ROI historically but Georgia is worst of the lot" },
          ].map((fade, i) => (
            <div key={i} style={{ fontSize: 10, padding: "4px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#e63946", fontWeight: 600 }}>{fade.t}</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#e6394622", color: "#e63946" }}>{fade.ratio}</span>
              </div>
              <div style={{ color: "#4a5a7a", fontSize: 9, marginTop: 1 }}>EV {fade.ev} vs {fade.cost} exp — {fade.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2026 LIVE
// ═══════════════════════════════════════════

function Live2026() {
  const [liveView, setLiveView] = useState("bracket");
  const [bracketMobileRegion, setBracketMobileRegion] = useState("E");
  const [nerdMode, setNerdMode] = useState(false);
  const [expandedSyn, setExpandedSyn] = useState(null);
  const [teamSort, setTeamSort] = useState({ key: "seed", dir: "asc" });
  const [popupSyn, setPopupSyn] = useState(null);
  const regions = ["S", "MW", "W", "E"];
  const regionNames = { S: "South", MW: "Midwest", W: "West", E: "East" };
  const regionColors = { S: "#e63946", MW: "#f4a261", W: "#2a9d8f", E: "#457b9d" };

  const pot = POT_2026;
  const payoutLabels = ["R32", "S16", "E8", "F4", "F2", "Ch"];
  const payoutCum = [0.005, 0.03, 0.06, 0.09, 0.12, 0.14];
  const payoutIncr = payoutCum.map((v, i) => i === 0 ? v : v - payoutCum[i - 1]);

  const synData = useMemo(() => {
    const agg = {};
    SYNDICATES_2026.forEach(syn => {
      const teams = TEAMS_2026.filter(t => t.s === syn.name);
      const tiers = { "1-2": 0, "3-4": 0, "5-8": 0, "9-12": 0, "13-16": 0 };
      teams.forEach(t => {
        if (t.seed <= 2) tiers["1-2"] += t.p;
        else if (t.seed <= 4) tiers["3-4"] += t.p;
        else if (t.seed <= 8) tiers["5-8"] += t.p;
        else if (t.seed <= 12) tiers["9-12"] += t.p;
        else tiers["13-16"] += t.p;
      });
      const alive = teams.filter(t => t.alive).length;
      agg[syn.name] = { ...syn, teams, tiers, alive, totalTeams: teams.length };
    });
    return agg;
  }, []);

  const tierColors = { "1-2": "#e63946", "3-4": "#f4a261", "5-8": "#2a9d8f", "9-12": "#457b9d", "13-16": "#6a4c93" };
  const cardBg = "#0f1829";
  const cardBorder = "#1e2a40";

  const views = [
    { key: "bracket", label: "Bracket" },
    { key: "leaderboard", label: "Leaderboard" },
    { key: "syndicates", label: "Syndicates" },
    { key: "teams", label: "All Teams" },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Sub-nav */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 12 }}>
        {views.map(v => (
          <button key={v.key} onClick={() => setLiveView(v.key)} style={{
            padding: "3px 10px", background: "transparent",
            border: "none", borderBottom: liveView === v.key ? "1px solid #4a9eff" : "1px solid transparent",
            color: liveView === v.key ? "#4a9eff" : "#4a5a7a", fontSize: 10, fontWeight: liveView === v.key ? 600 : 400,
            fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.5,
          }}>{v.label}</button>
        ))}
      </div>

      {/* ── LEADERBOARD VIEW ── */}
      {liveView === "leaderboard" && (() => {
        const incrPayouts = [0.005, 0.025, 0.03, 0.03, 0.03, 0.02].map(pct => Math.round(pct * pot));
        const cumPayouts = [0.005, 0.03, 0.06, 0.09, 0.12, 0.14].map(pct => Math.round(pct * pot));
        const roundLabels = ["R32", "S16", "E8", "F4", "F2", "Champ"];

        const isATS = seed => seed <= 2 || seed >= 15;
        const getR32Paid = t => {
          if (isATS(t.seed)) return t.ats === true;
          return t.w > 0;
        };

        const board = SYNDICATES_2026.map(syn => {
          const teams = synData[syn.name].teams;
          const teamsAlive = teams.filter(t => t.alive).length;
          const roundWins = [0,1,2,3,4,5].map(ri =>
            ri === 0
              ? teams.filter(t => getR32Paid(t)).length
              : teams.filter(t => t.w > ri).length
          );
          const roundEarnings = roundWins.map((wins, ri) => wins * incrPayouts[ri]);
          const totalEarned = roundEarnings.reduce((a, b) => a + b, 0);
          const net = totalEarned - syn.spent;
          const roi = syn.spent > 0 ? net / syn.spent : 0;
          return { ...syn, teamsAlive, totalTeams: teams.length, roundWins, roundEarnings, totalEarned, net, roi };
        }).sort((a, b) => b.net - a.net);

        const thS = { padding: "6px 4px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 9, borderBottom: "2px solid #1e2a40", whiteSpace: "nowrap" };
        const thL = { ...thS, textAlign: "left" };

        return (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={{ ...thL, width: 18 }}>#</th>
                  <th style={thL}>Syndicate</th>
                  <th style={thS}>Net</th>
                  <th style={thS}>Alive</th>
                  {roundLabels.map((r, ri) => <th key={r} style={thS}>{r}<br /><span style={{ fontWeight: 400, fontSize: 7, color: "#2a3a5a" }}>${incrPayouts[ri]}</span></th>)}
                  <th style={thS}>Earned</th>
                  <th style={thS}>Spent</th>
                  <th style={thS}>ROI</th>
                </tr>
              </thead>
              <tbody>
                {board.map((syn, i) => {
                  const synColor = SYNDICATE_COLORS[syn.name] || "#5a6a8a";
                  const netColor = syn.net > 0 ? "#2ecc71" : syn.net === 0 ? "#8a9aba" : "#e63946";
                  const isOpen = expandedSyn === syn.name;
                  const teams = synData[syn.name].teams.slice().sort((a, b) => b.p - a.p);
                  return (
                    <React.Fragment key={syn.name}>
                    <tr
                      onClick={() => setExpandedSyn(isOpen ? null : syn.name)}
                      style={{
                        borderBottom: isOpen ? "none" : "1px solid #111827",
                        background: isOpen ? synColor + "0d" : i % 2 === 0 ? "transparent" : "#0a0e1766",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "#111827"; }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#0a0e1766"; }}
                    >
                      <td style={{ padding: "6px 4px", color: "#5a6a8a", fontWeight: 700, fontSize: 10, width: 18 }}>{i + 1}</td>
                      <td style={{ padding: "6px 4px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <span style={{ color: synColor }}>{isOpen ? "▾" : "▸"} {syn.name}</span>
                        <span style={{ fontSize: 8, color: "#3a4a6a", marginLeft: 4 }}>{syn.totalTeams} teams</span>
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: netColor, fontWeight: 700 }}>
                        {syn.net >= 0 ? "+" : ""}${syn.net.toLocaleString()}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#8a9aba" }}>{syn.teamsAlive}/{syn.totalTeams}</td>
                      {syn.roundEarnings.map((re, ri) => (
                        <td key={ri} style={{ padding: "6px 4px", textAlign: "right", color: re > 0 ? "#e8e6e3" : "#1e2a40" }}>{re > 0 ? `$${re.toLocaleString()}` : "—"}</td>
                      ))}
                      <td style={{ padding: "6px 4px", textAlign: "right", color: syn.totalEarned > 0 ? "#e8e6e3" : "#1e2a40", fontWeight: 700 }}>
                        {syn.totalEarned > 0 ? `$${syn.totalEarned.toLocaleString()}` : "—"}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#e8e6e3", fontWeight: 600 }}>${syn.spent.toLocaleString()}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: netColor, fontWeight: 600 }}>
                        {(syn.roi * 100).toFixed(0)}%
                      </td>
                    </tr>
                    {isOpen && <>
                      <tr style={{ background: "#080c14" }}>
                        <td colSpan={13} style={{ padding: "3px 4px 2px 20px", fontSize: 8, color: "#3a4a6a", fontStyle: "italic" }}>
                          <span style={{ display: "inline-block", width: 8, height: 4, backgroundImage: "repeating-conic-gradient(#888 0% 25%, transparent 0% 50%)", backgroundSize: "4px 4px", marginRight: 4, verticalAlign: "middle" }} />
                          breakeven round
                        </td>
                      </tr>
                      {teams.map(t => {
                      const r32Paid = getR32Paid(t);
                      const teamEarned = [0,1,2,3,4,5].reduce((sum, ri) => {
                        if (ri === 0) return sum + (r32Paid ? incrPayouts[0] : 0);
                        return sum + (t.w > ri ? incrPayouts[ri] : 0);
                      }, 0);
                      const teamNet = teamEarned - t.p;
                      const beIdx = cumPayouts.findIndex(cp => cp >= t.p);
                      return (
                        <tr key={t.sd} style={{ background: "#080c14", borderBottom: "1px solid #0d1321" }}>
                          <td style={{ padding: "4px 4px" }} />
                          <td style={{ padding: "4px 4px", color: t.alive ? "#8a9aba" : "#3a4a6a", fontSize: 10, paddingLeft: 20 }}>
                            <span style={{ color: "#3a4a6a", fontSize: 9, marginRight: 3 }}>{t.seed}</span>
                            {t.t}
                            {!t.alive && <span style={{ color: "#e63946", fontSize: 8, marginLeft: 4 }}>✗</span>}
                            {t.spread && <span style={{ fontSize: 8, color: "#3a4a6a", marginLeft: 5 }}>+{t.spread}</span>}
                          </td>
                          <td style={{ padding: "4px 4px", textAlign: "right", color: teamNet >= 0 ? "#2ecc71" : "#e63946", fontSize: 10, fontWeight: 600 }}>{teamNet >= 0 ? "+" : ""}${teamNet.toLocaleString()}</td>
                          <td style={{ padding: "4px 4px", textAlign: "right", color: t.alive ? "#2ecc71" : "#3a4a6a", fontSize: 9 }}>{t.alive ? "✓" : "✗"}</td>
                          {[0,1,2,3,4,5].map(ri => {
                            const paid = ri === 0 ? r32Paid : t.w > ri;
                            const isBE = ri === beIdx;
                            const beReached = isBE && (ri === 0 ? r32Paid : t.w > ri);
                            return <td key={ri} style={{ padding: "4px 4px", textAlign: "right", color: paid ? "#e8e6e3" : "#1e2a40", fontSize: 10, position: "relative" }}>{paid ? `$${incrPayouts[ri]}` : "—"}{isBE && <span style={{ position: "absolute", bottom: 0, left: 2, right: 2, height: 3, backgroundImage: beReached ? "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)" : "repeating-conic-gradient(#888 0% 25%, transparent 0% 50%)", backgroundSize: "3px 3px", opacity: beReached ? 1 : 0.7 }} />}</td>;
                          })}
                          <td style={{ padding: "4px 4px", textAlign: "right", color: teamEarned > 0 ? "#e8e6e3" : "#1e2a40", fontSize: 10, fontWeight: 600 }}>{teamEarned > 0 ? `$${teamEarned.toLocaleString()}` : "—"}</td>
                          <td style={{ padding: "4px 4px", textAlign: "right", color: "#8a9aba", fontSize: 10 }}>${t.p.toLocaleString()}</td>
                          <td style={{ padding: "4px 4px" }} />
                        </tr>
                      );
                    })}
                    </>}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #1e2a40" }}>
                  <td colSpan={2} style={{ padding: "6px 4px", color: "#5a6a8a", fontWeight: 700, fontSize: 10 }}>TOTAL</td>
                  <td style={{ padding: "6px 4px" }} />
                  <td style={{ padding: "6px 4px", textAlign: "right", color: "#8a9aba" }}>{board.reduce((s, b) => s + b.teamsAlive, 0)}/64</td>
                  {[0,1,2,3,4,5].map(ri => {
                    const total = board.reduce((s, b) => s + b.roundEarnings[ri], 0);
                    return <td key={ri} style={{ padding: "6px 4px", textAlign: "right", color: total > 0 ? "#e8e6e3" : "#1e2a40", fontWeight: 600 }}>{total > 0 ? `$${total.toLocaleString()}` : "—"}</td>;
                  })}
                  <td style={{ padding: "6px 4px", textAlign: "right", color: "#e8e6e3", fontWeight: 700 }}>${board.reduce((s, b) => s + b.totalEarned, 0).toLocaleString()}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", color: "#e8e6e3", fontWeight: 700 }}>${board.reduce((s, b) => s + b.spent, 0).toLocaleString()}</td>
                  <td style={{ padding: "6px 4px" }} />
                </tr>
              </tfoot>
            </table>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 9, color: "#2a3a5a" }}>
              Tap a syndicate to see their teams · {board.reduce((s, b) => s + b.teamsAlive, 0)} teams alive
            </div>
          </div>
        );
      })()}

      {/* ── BRACKET VIEW ── */}
      {liveView === "bracket" && (() => {
        const bracketOrder = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
        const SLOT_H = 24;
        const TOTAL_H = 500;
        const isMobile = typeof window !== "undefined" && window.innerWidth < 820;

        const BSlot = ({ team, border, rtl }) => {
          if (!team) return (
            <div style={{ height: SLOT_H, display: "flex", alignItems: "center", padding: "0 6px", background: "#0a0e15", borderBottom: border ? "1px solid #151d2e" : "none", fontSize: 9, color: "#1e2a40" }}>—</div>
          );
          const sc = SYNDICATE_COLORS[team.s] || "#5a6a8a";
          return (
            <div style={{
              height: SLOT_H, display: "flex", alignItems: "center", padding: "0 4px",
              background: "#0d1321",
              borderBottom: border ? "1px solid #1e2a40" : "none",
              opacity: team.alive ? 1 : 0.35, gap: 3,
              flexDirection: rtl ? "row-reverse" : "row",
            }}>
              <span style={{ width: 14, fontSize: 9, fontWeight: 700, textAlign: "center", flexShrink: 0, color: "#5a6a8a" }}>{team.seed}</span>
              <span style={{ flex: 1, fontSize: 8.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#c8d6e5", textAlign: rtl ? "right" : "left" }}>{team.t}</span>
              <span onClick={e => { e.stopPropagation(); setPopupSyn(team.s); }} style={{ fontSize: 7, flexShrink: 0, fontWeight: 600, color: sc, padding: "0 3px", background: sc + "18", borderRadius: 2, cursor: "pointer" }}>{team.s.length > 5 ? team.s.slice(0,4) : team.s}</span>
              <span style={{ fontSize: 7, flexShrink: 0, fontWeight: 500, color: "#5a6a8a" }}>${team.p.toLocaleString()}</span>
            </div>
          );
        };

        const todayAbbr = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];

        const BMatch = ({ top, bot, rtl }) => {
          const region = top ? top.sd.split("-")[0] : (bot ? bot.sd.split("-")[0] : "");
          const seeds = [top, bot].filter(Boolean).map(t => t.seed).sort((a, b) => a - b);
          const gameKey = seeds.length === 2 ? `${region}-${seeds[0]}v${seeds[1]}` : "";
          const game = R64_GAMES[gameKey];
          const isToday = game && game.time.startsWith(todayAbbr);
          return (
            <div>
              {game && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 1px", fontSize: 6.5, color: isToday ? "#e8e6e3" : "#3a4a6a", fontWeight: isToday ? 600 : 400 }}>
                  <span>{isToday ? "TODAY " + game.time.split(" ")[1] : game.time}</span>
                  <span>{game.spread}</span>
                </div>
              )}
              <div style={{ border: `1px solid ${isToday ? "#4a9eff44" : "#1e2a40"}`, borderRadius: 3, overflow: "hidden", boxShadow: isToday ? "0 0 8px rgba(74,158,255,0.15)" : "none" }}>
                <BSlot team={top} border rtl={rtl} />
                <BSlot team={bot} rtl={rtl} />
              </div>
            </div>
          );
        };

        const BConn = ({ pairs, rtl }) => (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", width: 16, flexShrink: 0 }}>
            {Array.from({ length: pairs }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                {rtl ? (
                  <div style={{ width: "100%", height: "50%", borderLeft: "2px solid #1e2a40", borderTop: "2px solid #1e2a40", borderBottom: "2px solid #1e2a40", borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
                ) : (
                  <div style={{ width: "100%", height: "50%", borderRight: "2px solid #1e2a40", borderTop: "2px solid #1e2a40", borderBottom: "2px solid #1e2a40", borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
                )}
              </div>
            ))}
          </div>
        );

        const RoundCol = ({ n, w, rtl }) => (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", width: w, minWidth: w, flexShrink: 0 }}>
            {Array.from({ length: n }).map((_, i) => <BMatch key={i} rtl={rtl} />)}
          </div>
        );

        const hNeighbor = { E: "W", W: "E", S: "MW", MW: "S" };
        const vNeighbor = { E: "S", S: "E", W: "MW", MW: "W" };
        const isTop = { E: true, W: true, S: false, MW: false };

        const LiveRegionBracket = ({ region, rtl }) => {
          const bracketScrollRef = useRef(null);
          const edgeTimer = useRef(null);
          const autoScrolling = useRef(false);
          const tm = {};
          TEAMS_2026.filter(t => t.sd.startsWith(region + "-")).forEach(t => { tm[t.seed] = t; });
          const r64 = bracketOrder.map(([a, b]) => [tm[a], tm[b]]);
          const neighbor = hNeighbor[region];
          const vNbr = vNeighbor[region];
          const regionIsTop = isTop[region];

          useEffect(() => {
            if (bracketScrollRef.current) {
              autoScrolling.current = true;
              bracketScrollRef.current.scrollLeft = rtl ? bracketScrollRef.current.scrollWidth : 0;
              setTimeout(() => { autoScrolling.current = false; }, 150);
            }
            return () => { if (edgeTimer.current) clearTimeout(edgeTimer.current); };
          }, [region, rtl]);


          const handleEdgeScroll = useCallback(() => {
            if (!bracketScrollRef.current || !isMobile || autoScrolling.current) return;
            const el = bracketScrollRef.current;
            const atEnd = rtl ? el.scrollLeft <= 2 : el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
            if (atEnd) {
              if (!edgeTimer.current) {
                edgeTimer.current = setTimeout(() => {
                  edgeTimer.current = null;
                  setBracketMobileRegion(neighbor);
                }, 350);
              }
            } else {
              if (edgeTimer.current) { clearTimeout(edgeTimer.current); edgeTimer.current = null; }
            }
          }, [region, rtl, neighbor]);

          const roundPay = [0.005, 0.025, 0.03, 0.03, 0.03, 0.02].map(pct => "$" + Math.round(pct * pot).toLocaleString());
          const ltrHeaders = [
            { name: "FIRST ROUND", pay: roundPay[0] }, null,
            { name: "SECOND ROUND", pay: roundPay[1] }, null,
            { name: "SWEET 16", pay: roundPay[2] }, null,
            { name: "ELITE 8", pay: roundPay[3] },
          ];
          const rtlHeaders = [
            { name: "ELITE 8", pay: roundPay[3] }, null,
            { name: "SWEET 16", pay: roundPay[2] }, null,
            { name: "SECOND ROUND", pay: roundPay[1] }, null,
            { name: "FIRST ROUND", pay: roundPay[0] },
          ];
          const headers = rtl ? rtlHeaders : ltrHeaders;
          const colWidths = rtl ? [100, 16, 100, 16, 100, 16, 150] : [150, 16, 100, 16, 100, 16, 100];

          const r64Col = (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", width: 150, minWidth: 150, flexShrink: 0 }}>
              {r64.map(([t, b], i) => <BMatch key={i} top={t} bot={b} rtl={rtl} />)}
            </div>
          );

          const bracketContent = rtl ? (
            <>
              <RoundCol n={1} w={100} rtl={rtl} />
              <BConn pairs={1} rtl />
              <RoundCol n={2} w={100} rtl={rtl} />
              <BConn pairs={2} rtl />
              <RoundCol n={4} w={100} rtl={rtl} />
              <BConn pairs={4} rtl />
              {r64Col}
            </>
          ) : (
            <>
              {r64Col}
              <BConn pairs={4} />
              <RoundCol n={4} w={100} />
              <BConn pairs={2} />
              <RoundCol n={2} w={100} />
              <BConn pairs={1} />
              <RoundCol n={1} w={100} />
            </>
          );

          const totalW = 150 + 100*3 + 16*3;

          const vNav = isMobile && (
            <div
              onClick={() => setBracketMobileRegion(vNbr)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 0", cursor: "pointer", borderRadius: 6,
                background: "#0a0e17", border: "1px solid #1e2a40",
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 10, color: "#4a5a7a" }}>{regionIsTop ? "▼" : "▲"}</span>
              <span style={{ fontSize: 10, color: regionColors[vNbr], fontWeight: 600 }}>{regionNames[vNbr]}</span>
              <span style={{ fontSize: 8, color: "#3a4a6a" }}>Region</span>
            </div>
          );

          return (
            <div>
              {!regionIsTop && isMobile && <div style={{ marginBottom: 6 }}>{vNav}</div>}
              <div style={{ textAlign: "center", marginBottom: 8, padding: "6px 0", borderBottom: `2px solid ${regionColors[region]}44` }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: regionColors[region] }}>{regionNames[region].toUpperCase()} REGION</span>
              </div>
              <div
                ref={bracketScrollRef}
                onScroll={handleEdgeScroll}
                style={{
                  overflowX: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y",
                  border: "1px solid #1e2a40", borderRadius: 8, background: "#080c12",
                  paddingBottom: 8, paddingTop: 4,
                }}
              >
                {isMobile && (
                  <div style={{ fontSize: 7, textAlign: "center", padding: "2px 8px 4px", color: "#4a5a7a" }}>
                    {rtl ? "← scroll for later rounds · hold edge → " : "scroll for later rounds → · hold edge → "}{regionNames[neighbor]}
                  </div>
                )}
                <div style={{ display: "flex", marginBottom: 4, minWidth: totalW, paddingLeft: 8, paddingRight: 8 }}>
                  {colWidths.map((w, i) => (
                    <div key={i} style={{ width: w, minWidth: w, flexShrink: 0, textAlign: "center" }}>
                      {headers[i] && (
                        <>
                          <div style={{ fontSize: 7, color: "#3a4a6a", letterSpacing: 1, fontWeight: 600 }}>{headers[i].name}</div>
                          <div style={{ fontSize: 7, color: "#4a9eff", fontWeight: 500 }}>{headers[i].pay}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", height: TOTAL_H, minWidth: totalW, paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
                  {bracketContent}
                </div>
              </div>
              {regionIsTop && isMobile && <div style={{ marginTop: 6 }}>{vNav}</div>}
            </div>
          );
        };

        const regionOrder = ["E", "W", "S", "MW"];
        const rtlRegions = new Set(["W", "MW"]);
        const seedPairs = {1:16,16:1,2:15,15:2,3:14,14:3,4:13,13:4,5:12,12:5,6:11,11:6,7:10,10:7,8:9,9:8};
        const teamsBySD = {};
        TEAMS_2026.forEach(t => { teamsBySD[t.sd] = t; });

        return (
          <div>
            {isMobile ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 8 }}>
                  {regionOrder.map(r => (
                    <button key={r} onClick={() => setBracketMobileRegion(r)} style={{
                      padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", fontSize: 9,
                      background: "transparent", border: "none",
                      borderBottom: bracketMobileRegion === r ? `1px solid ${regionColors[r]}` : "1px solid transparent",
                      color: bracketMobileRegion === r ? regionColors[r] : "#3a4a6a",
                      fontWeight: bracketMobileRegion === r ? 700 : 400,
                      letterSpacing: 0.5, transition: "all 0.15s",
                    }}>{regionNames[r]}</button>
                  ))}
                </div>
                <LiveRegionBracket region={bracketMobileRegion} rtl={rtlRegions.has(bracketMobileRegion)} />
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {regionOrder.map(r => (
                  <div key={r}>
                    <LiveRegionBracket region={r} rtl={rtlRegions.has(r)} />
                  </div>
                ))}
              </div>
            )}

            {popupSyn && (() => {
              const dayOrd = { Thu: 0, Fri: 1, Sat: 2, Sun: 3 };
              const parseTime = (str) => {
                if (!str) return 9999;
                const [day, raw] = str.split(" ");
                const isPM = raw.endsWith("p");
                const [h, m] = raw.replace(/[ap]/, "").split(":").map(Number);
                const hr24 = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
                return (dayOrd[day] || 0) * 1440 + hr24 * 60 + m;
              };
              const synTeams = TEAMS_2026.filter(t => t.s === popupSyn).sort((a, b) => {
                const rgnA = a.sd.split("-")[0], rgnB = b.sd.split("-")[0];
                const sA = [a.seed, seedPairs[a.seed]].sort((x, y) => x - y);
                const sB = [b.seed, seedPairs[b.seed]].sort((x, y) => x - y);
                const gA = R64_GAMES[`${rgnA}-${sA[0]}v${sA[1]}`];
                const gB = R64_GAMES[`${rgnB}-${sB[0]}v${sB[1]}`];
                return parseTime(gA && gA.time) - parseTime(gB && gB.time);
              });
              const sc = SYNDICATE_COLORS[popupSyn] || "#5a6a8a";
              return (
                <div onClick={() => setPopupSyn(null)} style={{
                  position: "fixed", inset: 0, zIndex: 9999,
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
                }}>
                  <div onClick={e => e.stopPropagation()} style={{
                    background: "#0d1321", border: `1px solid ${sc}44`,
                    borderRadius: 10, padding: "16px 14px", maxWidth: 380, width: "100%",
                    maxHeight: "80vh", overflowY: "auto",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: sc }}>{popupSyn}</span>
                      <span style={{ fontSize: 10, color: "#5a6a8a" }}>{synTeams.length} teams · ${synTeams.reduce((s, t) => s + t.p, 0).toLocaleString()} spent</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e2a40" }}>
                          <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a6a8a", fontWeight: 500, fontSize: 8 }}>Team</th>
                          <th style={{ padding: "4px 4px", textAlign: "left", color: "#5a6a8a", fontWeight: 500, fontSize: 8 }}>vs</th>
                          <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 8 }}>Spread</th>
                          <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 8 }}>Time</th>
                          <th style={{ padding: "4px 4px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 8 }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {synTeams.map(t => {
                          const rgn = t.sd.split("-")[0];
                          const oppSeed = seedPairs[t.seed];
                          const opp = teamsBySD[`${rgn}-${oppSeed}`];
                          const seeds = [t.seed, oppSeed].sort((a, b) => a - b);
                          const game = R64_GAMES[`${rgn}-${seeds[0]}v${seeds[1]}`];
                          const isToday = game && game.time.startsWith(todayAbbr);
                          return (
                            <tr key={t.sd} style={{ borderBottom: "1px solid #111827", opacity: t.alive ? 1 : 0.4 }}>
                              <td style={{ padding: "5px 4px", color: "#e8e6e3", whiteSpace: "nowrap" }}>
                                <span style={{ color: "#3a4a6a", fontSize: 8, marginRight: 3 }}>{t.seed}{rgn}</span>{t.t}
                              </td>
                              <td style={{ padding: "5px 4px", color: "#8a9aba", whiteSpace: "nowrap" }}>
                                <span style={{ color: "#3a4a6a", fontSize: 8, marginRight: 3 }}>{oppSeed}</span>{opp ? opp.t : "—"}
                              </td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#8a9aba", fontSize: 9 }}>{game ? game.spread : "—"}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: isToday ? "#e8e6e3" : "#5a6a8a", fontWeight: isToday ? 600 : 400, fontSize: 9, whiteSpace: "nowrap" }}>
                                {isToday && game ? "TODAY " + game.time.split(" ")[1] : game ? game.time : "—"}
                              </td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#8a9aba", fontWeight: 600 }}>${t.p.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── SYNDICATES VIEW ── */}
      {liveView === "syndicates" && (() => {
        const histNameMap = { Stangs: "Mustangs" };
        const histSyns = { 2022: SYNDICATES_2022, 2023: SYNDICATES_2023, 2024: SYNDICATES_2024, 2025: SYNDICATES_2025 };
        const getHistorical = (name) => {
          const hName = histNameMap[name] || name;
          let totalSpent = 0, totalWon = 0, totalNet = 0, seasons = 0, wins = 0;
          [2022, 2023, 2024, 2025].forEach(y => {
            const found = histSyns[y].find(s => s.name === hName);
            if (found) { totalSpent += found.spent; totalWon += found.totalWon; totalNet += found.net; seasons++; if (found.net > 0) wins++; }
          });
          return { totalSpent, totalWon, totalNet, seasons, wins, roi: totalSpent > 0 ? totalNet / totalSpent : 0 };
        };

        const synProfiles = {
          Bacon: { strat: "Balanced", vibe: "Won it all in '23 (+$5.3K) then cratered in '24 (-$3.3K). Duke + Tennessee + Louisville is a nasty combo — three teams the models love. Texas and Iowa are cheap lottery tickets that could pop." },
          Hogan: { strat: "All-In Anchor", vibe: "The namesake syndicate finally broke even in '25 after three losing years. Swinging for the fences with Michigan ($3K) — the #1 KenPom team. Loaded in the West with Gonzaga/Arkansas/Miami. 10 teams = volume play." },
          Hudachek: { strat: "The Whale", vibe: "95% of his bankroll on two teams. Arizona ($3.2K) + UConn ($1.65K) = championship-or-bust. Won big in '24 with this same strategy. Only 3 teams total — fewest in the field. Saint Mary's is a $240 afterthought." },
          Tomek: { strat: "Moneyball Volume", vibe: "15 teams — most in the field by a mile. Owns all four 16-seed packages, two 15-seeds, and a spread of mid-tier value. Does not listen to the nerds or value. Purdue ($2K) is the anchor, Vanderbilt ($1K) is the sleeper. Casting the widest net in the pool. ATS plays on 15s/16s are smart upside." },
          Curran: { strat: "The GOAT Portfolio", vibe: "Best career record in Hogan history (+$6.8K, 3 winning years out of 4). Florida ($2.7K) gives him a legit title contender. UCLA, Wisconsin, and Kentucky are all models-love value plays. Ohio State and Missouri round out a beautifully diversified book." },
          Stangs: { strat: "Mid-Tier Assassin", vibe: "No flashy 1-seed, but STACKED at the 3-5 range where the models say value lives. Illinois + Kansas + St. John's is the best mid-tier core in the auction. If any of those three makes an Elite 8 run, it's a cash. Saint Louis at $140 is the swing play." },
          Crumbling: { strat: "Mr. Consistent", vibe: "The ONLY syndicate with 4 straight winning years. Quietly printing money while everyone chases 1-seeds. Michigan State ($1.55K) anchors a portfolio of pure 3-6 seed picks. Zero 1-seeds, zero 2-seeds — and somehow always wins. UNC at $320 is a sneaky value if Wilson comes back." },
          Smith: { strat: "Houston or Bust", vibe: "81% of the bankroll on Houston ($2.2K). All-in on Kelvin Sampson's squad making a deep run. If Houston hits the Final Four, Smith cashes a monster check. TCU, Georgia, and Santa Clara are cheap filler to pray on. Career record is rough (-$6.3K) — needs Houston badly." },
          Coach: { strat: "Iowa State Believer", vibe: "76% of spend on Iowa State ($2.05K) — the Big 12 tourney champ. Nebraska ($520) is a solid 4-seed value play. Smart ATS move scooping both Furman (+20.5) and Queens (+25.5) as 15-seeds. If Iowa State makes a run and a 15-seed covers, Coach eats cheap." },
        };

        const synCards = SYNDICATES_2026.map(syn => {
          const sd = synData[syn.name];
          const teamEVs = sd.teams.map(t => {
            const val = getTeamValueLive2026({ r: t.sd.split("-")[0], s: t.seed }, t.p);
            const ratio = t.p > 0 ? val.fairValue / t.p : 0;
            return { ...t, ev: val.fairValue, ratio, label: val.label, color: val.color, roundEV: val.roundEV };
          });
          const totalEV = teamEVs.reduce((a, t) => a + t.ev, 0);
          const portfolioRatio = totalEV / syn.spent;
          const bestValueTeam = teamEVs.reduce((best, t) => t.ratio > best.ratio ? t : best, teamEVs[0]);
          const topTeam = teamEVs.reduce((best, t) => t.p > best.p ? t : best, teamEVs[0]);
          const concentration = topTeam.p / syn.spent;
          const regionsHit = [...new Set(sd.teams.map(t => t.sd.split("-")[0]))];
          const buys = teamEVs.filter(t => t.label === "BUY").length;
          const fairs = teamEVs.filter(t => t.label === "FAIR").length;
          const avoids = teamEVs.filter(t => t.label === "AVOID").length;
          const hist = getHistorical(syn.name);
          const profile = synProfiles[syn.name] || { strat: "Unknown", vibe: "" };
          const champEquity = sd.teams.reduce((sum, t) => {
            const key = `${t.sd.split("-")[0]}-${t.seed}`;
            const tr = TORIK_ROUNDS[key] || [0,0,0,0,0,0];
            const em = EM_ROUNDS[key] || [0,0,0,0,0,0];
            return sum + ((tr[5] + em[5]) / 2);
          }, 0);
          return { ...syn, sd, teamEVs, totalEV, portfolioRatio, bestValueTeam, topTeam, concentration, regionsHit, buys, fairs, avoids, hist, profile, champEquity };
        }).sort((a, b) => b.spent - a.spent);

        const bestPortfolio = synCards[0];
        const biggestSpender = synCards.reduce((a, b) => b.spent > a.spent ? b : a);
        const mostTeams = synCards.reduce((a, b) => b.sd.totalTeams > a.sd.totalTeams ? b : a);
        const mostConcentrated = synCards.reduce((a, b) => b.concentration > a.concentration ? b : a);
        const bestChampEquity = synCards.reduce((a, b) => b.champEquity > a.champEquity ? b : a);

        return (
          <div>
            {/* Nerd Mode toggle switch */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: nerdMode ? "#7c5cfc" : "#5a6a8a", fontWeight: 600, letterSpacing: 0.5 }}>Nerd Mode</span>
              <div
                onClick={() => setNerdMode(!nerdMode)}
                style={{
                  width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                  background: nerdMode ? "#7c5cfc" : "#1e2a40",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 8,
                  background: nerdMode ? "#fff" : "#4a5a7a",
                  position: "absolute", top: 2,
                  left: nerdMode ? 18 : 2,
                  transition: "left 0.2s, background 0.2s",
                }} />
              </div>
            </div>

            {!nerdMode ? (() => {
              const cumPayouts = [0.005, 0.03, 0.06, 0.09, 0.12, 0.14].map(pct => Math.round(pct * POT_2026));
              const rl = ["R32","S16","E8","F4","F2","Ch"];
              const seedPairs = {1:16,16:1,2:15,15:2,3:14,14:3,4:13,13:4,5:12,12:5,6:11,11:6,7:10,10:7,8:9,9:8};
              const teamsBySD = {};
              TEAMS_2026.forEach(t => { teamsBySD[t.sd] = t; });
              const r32Pay = cumPayouts[0];
              const thS = { padding: "4px 8px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 9, borderBottom: "1px solid #1e2a40" };
              const thL = { ...thS, textAlign: "left" };
              return (
              <div style={{ overflowX: "auto" }}>
                {synCards.map(syn => {
                  const synColor = SYNDICATE_COLORS[syn.name] || "#5a6a8a";
                  const sorted = syn.teamEVs.slice().sort((a, b) => b.p - a.p);
                  const totalPrice = sorted.reduce((s, t) => s + t.p, 0);
                  return (
                    <div key={syn.name} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 10px", borderLeft: `3px solid ${synColor}`, background: "#0d1321" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#e8e6e3" }}>{syn.name}</span>
                        <span style={{ fontSize: 11, color: "#8a9aba" }}>{sorted.length} teams</span>
                        <span style={{ fontSize: 9, color: "#3a4a6a" }}>R1 payout: ${r32Pay}</span>
                        <span style={{ fontSize: 11, color: "#8a9aba", marginLeft: "auto" }}>${totalPrice.toLocaleString()} spent</span>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                        <thead>
                          <tr>
                            <th style={thL}>Team</th>
                            <th style={thS}>Price</th>
                            <th style={thL}>R1 Opponent</th>
                            <th style={thS}>Spread</th>
                            <th style={thS}>B/E</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((t, ti) => {
                            const rgn = t.sd.split("-")[0];
                            const oppSeed = seedPairs[t.seed];
                            const oppSD = `${rgn}-${oppSeed}`;
                            const opp = teamsBySD[oppSD];
                            const seeds = [t.seed, oppSeed].sort((a, b) => a - b);
                            const gameKey = `${rgn}-${seeds[0]}v${seeds[1]}`;
                            const game = R64_GAMES[gameKey];
                            const beIdx = cumPayouts.findIndex(cp => cp >= t.p);
                            const beLabel = beIdx >= 0 ? rl[beIdx] : "—";
                            return (
                              <tr key={t.sd} style={{ borderBottom: "1px solid #111827", background: ti % 2 === 0 ? "transparent" : "#0a0e1766" }}>
                                <td style={{ padding: "4px 8px", color: "#e8e6e3", whiteSpace: "nowrap" }}>
                                  <span style={{ color: "#5a6a8a", fontSize: 9, marginRight: 4 }}>{t.seed}</span>{t.t}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "right", color: "#e8e6e3", fontWeight: 600 }}>${t.p.toLocaleString()}</td>
                                <td style={{ padding: "4px 8px", color: "#8a9aba", whiteSpace: "nowrap" }}>
                                  <span style={{ color: "#3a4a6a", fontSize: 9, marginRight: 4 }}>{oppSeed}</span>{opp ? opp.t : "—"}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "right", color: "#8a9aba", fontSize: 9 }}>{game ? game.spread : "—"}</td>
                                <td style={{ padding: "4px 8px", textAlign: "right", color: "#8a9aba", fontWeight: 500 }}>{beLabel}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              );
            })() : (
            /* ── NERD MODE (cards) ── */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
              {synCards.map(syn => {
                const synColor = SYNDICATE_COLORS[syn.name] || "#5a6a8a";
                const ratioColor = syn.portfolioRatio >= 1.1 ? "#2ecc71" : syn.portfolioRatio >= 0.85 ? "#e9c46a" : "#e63946";
                return (
                  <div key={syn.name} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 14 }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <div style={{ width: 4, height: 22, borderRadius: 2, background: synColor }} />
                          <span style={{ fontSize: 16, fontWeight: 700, color: synColor }}>{syn.name}</span>
                          <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "#111827", color: "#7a8aaa", fontWeight: 600, letterSpacing: 0.5 }}>{syn.profile.strat}</span>
                        </div>
                        <div style={{ fontSize: 9, color: "#5a6a8a", marginLeft: 12 }}>
                          {syn.sd.totalTeams} teams · {syn.regionsHit.length} regions · {syn.buys} BUY · {syn.fairs} FAIR · {syn.avoids} AVOID
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e6e3", fontFamily: "'Space Grotesk', sans-serif" }}>${syn.spent.toLocaleString()}</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "baseline", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 10, color: ratioColor, fontWeight: 700 }}>EV ${syn.totalEV.toLocaleString()}</span>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: ratioColor + "22", color: ratioColor }}>{syn.portfolioRatio.toFixed(2)}x</span>
                        </div>
                      </div>
                    </div>

                    {/* Tier bar */}
                    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8, background: "#1a2235" }}>
                      {Object.entries(syn.sd.tiers).map(([tier, amt]) => (
                        <div key={tier} style={{ width: `${(amt / syn.spent) * 100}%`, background: tierColors[tier], transition: "width 0.3s" }} />
                      ))}
                    </div>

                    {/* Quick stats strip */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "Champ Equity", value: `${(syn.champEquity * 100).toFixed(1)}%`, color: syn.champEquity > 0.15 ? "#2ecc71" : syn.champEquity > 0.05 ? "#e9c46a" : "#5a6a8a" },
                        { label: "Concentration", value: `${Math.round(syn.concentration * 100)}%`, color: syn.concentration > 0.6 ? "#e63946" : syn.concentration > 0.4 ? "#e9c46a" : "#2ecc71" },
                        { label: "Best Value", value: `${syn.bestValueTeam.t.split(" ")[0]} ${syn.bestValueTeam.ratio.toFixed(1)}x`, color: syn.bestValueTeam.ratio >= 1.2 ? "#2ecc71" : "#e9c46a" },
                        { label: `Career (${syn.hist.seasons}yr)`, value: syn.hist.seasons > 0 ? `${syn.hist.totalNet >= 0 ? "+" : ""}$${syn.hist.totalNet.toLocaleString()}` : "Rookie", color: syn.hist.totalNet >= 0 ? "#2ecc71" : "#e63946" },
                      ].map(stat => (
                        <div key={stat.label} style={{ flex: "1 1 70px", background: "#0a0e17", borderRadius: 4, padding: "4px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: 7, color: "#3a4a6a", letterSpacing: 0.3 }}>{stat.label}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: stat.color, fontFamily: "'Space Grotesk', sans-serif" }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Team list */}
                    <div style={{ fontSize: 10, marginBottom: 8 }}>
                      {syn.teamEVs.sort((a, b) => b.p - a.p).map(t => {
                        const isTop = t.p === syn.topTeam.p;
                        return (
                          <div key={t.sd} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "3px 0", borderBottom: "1px solid #0d1321",
                            opacity: t.alive ? 1 : 0.35,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                              <span style={{ color: "#3a4a6a", fontSize: 7, fontWeight: 600, width: 16, textAlign: "right", flexShrink: 0 }}>{t.sd.split("-")[0]}</span>
                              <span style={{ color: t.seed <= 2 ? "#4a9eff" : t.seed <= 4 ? "#7c5cfc" : "#5a6a8a", fontSize: 9, fontWeight: 700, width: 14, textAlign: "right", flexShrink: 0 }}>{t.seed}</span>
                              <span style={{ color: isTop ? "#e8e6e3" : "#8a9aba", fontWeight: isTop ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {t.t}
                              </span>
                              {t.spread ? <span style={{ color: "#3a4a6a", fontSize: 7, flexShrink: 0 }}>+{t.spread}</span> : null}
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexShrink: 0 }}>
                              <span style={{ color: "#e8e6e3", fontWeight: 600, fontSize: 10 }}>${t.p.toLocaleString()}</span>
                              <span style={{ fontSize: 8, color: t.color, fontWeight: 600 }}>EV ${t.ev.toLocaleString()}</span>
                              <span style={{ fontSize: 7, fontWeight: 700, padding: "1px 3px", borderRadius: 2, background: t.color + "22", color: t.color }}>{t.ratio.toFixed(1)}x</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vibe blurb */}
                    <div style={{ background: "#0a0e17", borderRadius: 6, padding: "8px 10px", borderLeft: `2px solid ${synColor}44` }}>
                      <div style={{ fontSize: 9, color: "#8a9aba", lineHeight: 1.5 }}>{syn.profile.vibe}</div>
                    </div>

                    {/* Historical record footer */}
                    {syn.hist.seasons > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 8, color: "#4a5a7a" }}>
                        <span>Career: {syn.hist.wins}W-{syn.hist.seasons - syn.hist.wins}L ({syn.hist.seasons} seasons)</span>
                        <span style={{ color: syn.hist.roi >= 0 ? "#2ecc71" : "#e63946", fontWeight: 600 }}>{(syn.hist.roi * 100).toFixed(0)}% career ROI</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );
      })()}

      {/* ── ALL TEAMS VIEW ── */}
      {liveView === "teams" && (() => {
        const handleTeamSort = (key) => {
          if (teamSort.key === key) setTeamSort({ key, dir: teamSort.dir === "desc" ? "asc" : "desc" });
          else setTeamSort({ key, dir: key === "team" || key === "owner" || key === "region" ? "asc" : "desc" });
        };
        const arrow = (key) => teamSort.key === key ? (teamSort.dir === "desc" ? " ▼" : " ▲") : "";

        const enriched = TEAMS_2026.map(t => {
          const region = t.sd.split("-")[0];
          const val = getTeamValueLive2026({ r: region, s: t.seed }, t.p);
          return { ...t, region, ev: val.fairValue, ratio: val.fairValue / t.p, label: val.label, color: val.color };
        });

        const dir = teamSort.dir === "desc" ? 1 : -1;
        const sortFns = {
          seed: (a, b) => dir * (a.seed - b.seed),
          team: (a, b) => dir * a.t.localeCompare(b.t),
          region: (a, b) => dir * a.region.localeCompare(b.region),
          owner: (a, b) => dir * a.s.localeCompare(b.s),
          price: (a, b) => dir * (b.p - a.p),
          ev: (a, b) => dir * (b.ev - a.ev),
          ratio: (a, b) => dir * (b.ratio - a.ratio),
        };
        const sorted = enriched.slice().sort(sortFns[teamSort.key] || sortFns.seed);

        const cols = [
          { key: "seed", label: "Seed", align: "left" },
          { key: "team", label: "Team", align: "left" },
          { key: "region", label: "Region", align: "left" },
          { key: "owner", label: "Owner", align: "left" },
          { key: "price", label: "Price", align: "right" },
          { key: "ev", label: "EV", align: "right" },
          { key: "ratio", label: "Ratio", align: "right" },
        ];

        return (
          <div style={{ maxHeight: 700, overflowY: "auto", borderRadius: 8, border: `1px solid ${cardBorder}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead style={{ position: "sticky", top: 0, background: "#0d1321", zIndex: 1 }}>
                <tr style={{ borderBottom: "1px solid #1e2a40" }}>
                  {cols.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleTeamSort(col.key)}
                      style={{
                        padding: "8px 8px", textAlign: col.align,
                        color: teamSort.key === col.key ? "#4a9eff" : "#4a6a8a",
                        fontWeight: teamSort.key === col.key ? 700 : 500,
                        fontSize: 9, letterSpacing: 1, textTransform: "uppercase",
                        whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
                        borderBottom: teamSort.key === col.key ? "2px solid #4a9eff" : "none",
                      }}
                    >{col.label}{arrow(col.key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => {
                  const synColor = SYNDICATE_COLORS[t.s] || "#5a6a8a";
                  return (
                    <tr key={t.sd} style={{ borderBottom: "1px solid #0d1321", opacity: t.alive ? 1 : 0.35 }}>
                      <td style={{ padding: "6px 8px", color: "#8a9aba", fontWeight: 600 }}>{t.seed}</td>
                      <td style={{ padding: "6px 8px", color: "#e8e6e3", fontWeight: 500 }}>{t.t}</td>
                      <td style={{ padding: "6px 8px", color: "#8a9aba", fontSize: 10 }}>{regionNames[t.region]}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 1, background: synColor }} />
                          <span style={{ color: "#8a9aba", fontSize: 10 }}>{t.s}</span>
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#e8e6e3", fontWeight: 600 }}>${t.p.toLocaleString()}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8a9aba" }}>${t.ev.toLocaleString()}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: t.ratio >= 1.0 ? "#2ecc71" : t.ratio >= 0.7 ? "#e9c46a" : "#e63946", fontWeight: 600 }}>{t.ratio.toFixed(2)}x</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 9, color: "#3a4a6a", padding: 8, textAlign: "center" }}>Tap any column header to sort</div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════
// SPENDING ANALYSIS
// ═══════════════════════════════════════════

function SpendingAnalysis() {
  const [spendView, setSpendView] = useState("overview");

  const allSyns = { 2022: SYNDICATES_2022, 2023: SYNDICATES_2023, 2024: SYNDICATES_2024, 2025: SYNDICATES_2025 };
  const allTeams = { 2022: TEAMS_2022, 2023: TEAMS_2023, 2024: TEAMS_2024, 2025: TEAMS_2025 };
  const yearData = [2022, 2023, 2024, 2025].map(year => {
    const syndicates = allSyns[year];
    const teams = allTeams[year];
    const pot = syndicates.reduce((a, s) => a + s.spent, 0);
    const numSyn = syndicates.length;
    const avgSpend = Math.round(pot / numSyn);

    const bySeed = {};
    for (let s = 1; s <= 16; s++) bySeed[s] = { total: 0, count: 0, prices: [] };
    for (const t of teams) {
      bySeed[t.seed].total += t.p;
      bySeed[t.seed].count++;
      bySeed[t.seed].prices.push(t.p);
    }
    for (let s = 1; s <= 16; s++) {
      bySeed[s].avg = bySeed[s].count > 0 ? Math.round(bySeed[s].total / bySeed[s].count) : 0;
      bySeed[s].pctOfPot = (bySeed[s].total / pot * 100);
      bySeed[s].max = Math.max(...(bySeed[s].prices.length ? bySeed[s].prices : [0]));
      bySeed[s].min = Math.min(...(bySeed[s].prices.length ? bySeed[s].prices : [0]));
    }

    const tiers = { "1-2": { seeds: [1,2], total: 0 }, "3-4": { seeds: [3,4], total: 0 }, "5-8": { seeds: [5,6,7,8], total: 0 }, "9-12": { seeds: [9,10,11,12], total: 0 }, "13-16": { seeds: [13,14,15,16], total: 0 } };
    for (const [, tier] of Object.entries(tiers)) {
      tier.total = tier.seeds.reduce((a, s) => a + bySeed[s].total, 0);
      tier.pct = (tier.total / pot * 100);
    }

    const synProfiles = {};
    for (const syn of syndicates) {
      const synTeams = teams.filter(t => t.s === syn.name);
      const topSpend = synTeams.filter(t => t.seed <= 2).reduce((a, t) => a + t.p, 0);
      const eliteSpend = synTeams.filter(t => t.seed >= 3 && t.seed <= 4).reduce((a, t) => a + t.p, 0);
      const midSpend = synTeams.filter(t => t.seed >= 5 && t.seed <= 8).reduce((a, t) => a + t.p, 0);
      const lowSpend = synTeams.filter(t => t.seed >= 9 && t.seed <= 12).reduce((a, t) => a + t.p, 0);
      const bottomSpend = synTeams.filter(t => t.seed >= 13).reduce((a, t) => a + t.p, 0);
      const maxTeam = synTeams.length ? Math.max(...synTeams.map(t => t.p)) : 0;
      synProfiles[syn.name] = { spent: syn.spent, won: syn.totalWon, net: syn.net, count: synTeams.length, topPct: syn.spent ? (topSpend / syn.spent * 100) : 0, elitePct: syn.spent ? (eliteSpend / syn.spent * 100) : 0, midPct: syn.spent ? (midSpend / syn.spent * 100) : 0, lowPct: syn.spent ? (lowSpend / syn.spent * 100) : 0, bottomPct: syn.spent ? (bottomSpend / syn.spent * 100) : 0, maxTeam, concentration: syn.spent ? (maxTeam / syn.spent * 100) : 0 };
    }

    return { year, pot, numSyn, avgSpend, bySeed, tiers, synProfiles, syndicates };
  });

  const tierColors = { "1-2": "#e63946", "3-4": "#f4a261", "5-8": "#2a9d8f", "9-12": "#457b9d", "13-16": "#6a4c93" };
  const tierLabels = { "1-2": "Top Seeds (1-2)", "3-4": "Elite (3-4)", "5-8": "Mid (5-8)", "9-12": "Low-Mid (9-12)", "13-16": "Bottom (13-16)" };

  const views = [
    { key: "overview", label: "Overview" },
    { key: "seeds", label: "By Seed" },
    { key: "syndicates", label: "By Syndicate" },
    { key: "takeaways", label: "Takeaways" },
  ];

  const cardBg = "#0f1829";
  const cardBorder = "#1e2a40";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, margin: "0 0 4px 0", color: "#e8e6e3" }}>Spending Analysis</h2>
        <div style={{ fontSize: 11, color: "#5a6a8a" }}>Where the money goes — 2022 through 2025</div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {views.map(v => (
          <button key={v.key} onClick={() => setSpendView(v.key)} style={{
            padding: "6px 16px", background: spendView === v.key ? "#4a9eff22" : "transparent",
            border: `1px solid ${spendView === v.key ? "#4a9eff" : "#1e2a40"}`, borderRadius: 5,
            color: spendView === v.key ? "#4a9eff" : "#5a6a8a", fontSize: 11, fontWeight: spendView === v.key ? 700 : 400,
            fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.5,
          }}>{v.label}</button>
        ))}
      </div>

      {spendView === "overview" && (
        <div>
          {/* Pot comparison */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 12 }}>Total Pot by Year</div>
            {yearData.map(yd => {
              const maxPot = Math.max(...yearData.map(y => y.pot));
              return (
                <div key={yd.year} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: "#8a9aba" }}>{yd.year} <span style={{ color: "#5a6a8a" }}>({yd.numSyn} syndicates)</span></span>
                    <span style={{ color: "#e8e6e3", fontWeight: 600 }}>${yd.pot.toLocaleString()} <span style={{ color: "#5a6a8a", fontWeight: 400 }}>(avg ${yd.avgSpend}/syn)</span></span>
                  </div>
                  <div style={{ background: "#1a2235", borderRadius: 3, height: 22, overflow: "hidden" }}>
                    <div style={{ width: `${(yd.pot / maxPot) * 100}%`, height: "100%", borderRadius: 3, background: yd.year === 2024 ? "linear-gradient(90deg, #e63946, #f4a261)" : "linear-gradient(90deg, #4a9eff, #7c5cfc)", transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: "#5a6a8a", marginTop: 8, lineHeight: 1.5 }}>
              8-syn pots are stable: $31.0K ('22), $29.2K ('23), $31.2K ('25). The 2024 outlier (<span style={{ color: "#e63946", fontWeight: 600 }}>$35.5K</span>) was purely from Tomek joining as 9th syndicate.
            </div>
          </div>

          {/* Tier allocation stacked bars */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 4 }}>Spending by Tier — % of Pot</div>
            <div style={{ fontSize: 10, color: "#5a6a8a", marginBottom: 14 }}>Where each dollar went</div>
            {yearData.map(yd => (
              <div key={yd.year} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#8a9aba", marginBottom: 4, fontWeight: 500 }}>{yd.year}</div>
                <div style={{ display: "flex", height: 28, borderRadius: 4, overflow: "hidden", background: "#1a2235" }}>
                  {Object.entries(yd.tiers).map(([key, tier]) => (
                    <div key={key} style={{
                      width: `${tier.pct}%`, background: tierColors[key], display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 600, color: "#fff", minWidth: tier.pct > 5 ? 0 : 0,
                      transition: "width 0.5s",
                    }}>
                      {tier.pct >= 8 ? `${tier.pct.toFixed(0)}%` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              {Object.entries(tierLabels).map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#8a9aba" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: tierColors[key] }} />
                  {label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#5a6a8a", marginTop: 10, lineHeight: 1.5 }}>
              Top seeds (1-2) ate <span style={{ color: "#e63946", fontWeight: 600 }}>49.7%</span> of the 2024 pot vs <span style={{ color: "#4a9eff" }}>39-40%</span> in 8-syn years.
              Mid-tier (5-8) got squeezed from <span style={{ color: "#4a9eff" }}>20-23%</span> to just <span style={{ color: "#e63946" }}>15.0%</span> in the 9-syn year.
            </div>
          </div>

          {/* Year-over-year deltas — both transitions */}
          {[
            { from: 1, to: 2, title: "2023 → 2024: Where the Extra $6,290 Went", subtitle: "8 → 9 syndicates (+Tomek)", accentUp: "#2ecc71", accentDown: "#e63946",
              blurb: <>
                <span style={{ color: "#e63946", fontWeight: 600 }}>70% of the increase</span> went to 1-seeds alone ($4,430). Top 3 seeds absorbed $7,280 — more than the total pot increase.
                Mid-tier 5 and 6 seeds actually got <span style={{ color: "#2ecc71" }}>cheaper</span> as budgets were exhausted on the top.
              </> },
            { from: 2, to: 3, title: "2024 → 2025: The Correction (−$4,280)", subtitle: "9 → 8 syndicates (−Smith)", accentUp: "#2ecc71", accentDown: "#4a9eff",
              blurb: <>
                1-seeds gave back <span style={{ color: "#4a9eff", fontWeight: 600 }}>$1,850</span> and 2-seeds dropped <span style={{ color: "#4a9eff", fontWeight: 600 }}>$1,300</span> — almost the exact reverse of the 2024 inflation.
                Mid-tier (5-8) partially recovered as spending re-balanced. The bottom (13-16) stayed flat across all 4 years.
              </> },
          ].map(({ from, to, title, subtitle, accentUp, accentDown, blurb }) => {
            const dFrom = yearData[from].bySeed;
            const dTo = yearData[to].bySeed;
            const deltas = [];
            for (let s = 1; s <= 16; s++) deltas.push({ seed: s, delta: dTo[s].total - dFrom[s].total });
            deltas.sort((a, b) => b.delta - a.delta);
            const maxAbs = Math.max(...deltas.map(d => Math.abs(d.delta)));
            return (
              <div key={title} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 10, color: "#5a6a8a", marginBottom: 14 }}>{subtitle}</div>
                {deltas.map(d => (
                  <div key={d.seed} style={{ display: "flex", alignItems: "center", marginBottom: 3, fontSize: 11 }}>
                    <span style={{ width: 50, color: "#8a9aba", fontWeight: 500 }}>Seed {d.seed}</span>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", height: 16 }}>
                      {d.delta >= 0 ? (
                        <div style={{ marginLeft: "50%", width: `${(d.delta / maxAbs) * 50}%`, height: 12, background: accentUp, borderRadius: "0 3px 3px 0", minWidth: d.delta > 0 ? 2 : 0 }} />
                      ) : (
                        <div style={{ marginLeft: `${50 + (d.delta / maxAbs) * 50}%`, width: `${(-d.delta / maxAbs) * 50}%`, height: 12, background: accentDown, borderRadius: "3px 0 0 3px", minWidth: 2 }} />
                      )}
                    </div>
                    <span style={{ width: 65, textAlign: "right", color: d.delta >= 0 ? accentUp : accentDown, fontWeight: 600, fontSize: 10 }}>
                      {d.delta >= 0 ? "+" : ""}${d.delta.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "#5a6a8a", marginTop: 10, lineHeight: 1.5 }}>{blurb}</div>
              </div>
            );
          })}
        </div>
      )}

      {spendView === "seeds" && (
        <div>
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 12 }}>Average Price per Team by Seed</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e2a40" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>Seed</th>
                    {yearData.map(yd => (
                      <th key={yd.year} style={{ padding: "6px 8px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>{yd.year}</th>
                    ))}
                    <th style={{ padding: "6px 8px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>Δ 23→24</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>Δ 24→25</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>% of Pot</th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(seed => {
                    const d23 = yearData[1].bySeed[seed];
                    const d24 = yearData[2].bySeed[seed];
                    const d25 = yearData[3].bySeed[seed];
                    const delta1 = d24.avg - d23.avg;
                    const delta2 = d25.avg - d24.avg;
                    const avgPctOfPot = yearData.reduce((a, yd) => a + yd.bySeed[seed].pctOfPot, 0) / yearData.length;
                    const isTop = seed <= 2;
                    return (
                      <tr key={seed} style={{ borderBottom: "1px solid #0d1321", background: isTop ? "#14203a" : "transparent" }}>
                        <td style={{ padding: "5px 8px", color: isTop ? "#e9c46a" : "#8a9aba", fontWeight: 600 }}>{seed}</td>
                        {yearData.map(yd => (
                          <td key={yd.year} style={{ padding: "5px 8px", textAlign: "right", color: yd.year === 2024 ? "#e8e6e3" : "#8a9aba", fontWeight: yd.year === 2024 ? 600 : 400 }}>${yd.bySeed[seed].avg.toLocaleString()}</td>
                        ))}
                        <td style={{ padding: "5px 8px", textAlign: "right", color: delta1 >= 0 ? "#2ecc71" : "#e63946", fontWeight: 600 }}>
                          {delta1 >= 0 ? "+" : ""}${delta1.toLocaleString()}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: delta2 >= 0 ? "#2ecc71" : "#e63946", fontWeight: 600 }}>
                          {delta2 >= 0 ? "+" : ""}${delta2.toLocaleString()}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", color: "#5a6a8a" }}>{avgPctOfPot.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price ranges by seed */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 4 }}>Price Range by Seed (All Years)</div>
            <div style={{ fontSize: 10, color: "#5a6a8a", marginBottom: 14 }}>Min to max price paid, with average marked</div>
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(seed => {
              const allPrices = ALL_TEAMS.filter(t => t.seed === seed).map(t => t.p);
              const min = Math.min(...allPrices);
              const max = Math.max(...allPrices);
              const avg = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);
              const globalMax = 3350;
              return (
                <div key={seed} style={{ display: "flex", alignItems: "center", marginBottom: 4, fontSize: 10 }}>
                  <span style={{ width: 35, color: seed <= 2 ? "#e9c46a" : "#8a9aba", fontWeight: 600 }}>{seed}</span>
                  <div style={{ flex: 1, position: "relative", height: 14, background: "#1a2235", borderRadius: 3 }}>
                    <div style={{
                      position: "absolute", left: `${(min / globalMax) * 100}%`, width: `${((max - min) / globalMax) * 100}%`,
                      height: "100%", background: seed <= 2 ? "#e6394644" : seed <= 4 ? "#f4a26144" : "#4a9eff33", borderRadius: 3,
                    }} />
                    <div style={{
                      position: "absolute", left: `${(avg / globalMax) * 100}%`, top: 0, width: 2, height: "100%",
                      background: seed <= 2 ? "#e63946" : seed <= 4 ? "#f4a261" : "#4a9eff",
                    }} />
                  </div>
                  <span style={{ width: 90, textAlign: "right", color: "#5a6a8a", fontSize: 9 }}>${min}–${max.toLocaleString()} (avg ${avg})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {spendView === "syndicates" && (
        <div>
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 4 }}>Syndicate Strategy Profiles</div>
            <div style={{ fontSize: 10, color: "#5a6a8a", marginBottom: 14 }}>How each syndicate allocates their budget across seed tiers (4-year avg)</div>
            {(() => {
              const allNames = [...new Set(yearData.flatMap(yd => Object.keys(yd.synProfiles)))];
              return allNames.sort().map(name => {
                const profiles = yearData.filter(yd => yd.synProfiles[name]).map(yd => yd.synProfiles[name]);
                const avgTop = profiles.reduce((a, p) => a + p.topPct, 0) / profiles.length;
                const avgElite = profiles.reduce((a, p) => a + p.elitePct, 0) / profiles.length;
                const avgMid = profiles.reduce((a, p) => a + p.midPct, 0) / profiles.length;
                const avgLow = profiles.reduce((a, p) => a + p.lowPct, 0) / profiles.length;
                const avgBottom = profiles.reduce((a, p) => a + p.bottomPct, 0) / profiles.length;
                const avgConcentration = profiles.reduce((a, p) => a + p.concentration, 0) / profiles.length;
                const totalSpent = profiles.reduce((a, p) => a + p.spent, 0);
                const totalWon = profiles.reduce((a, p) => a + p.won, 0);
                const totalNet = profiles.reduce((a, p) => a + p.net, 0);
                const yearsActive = profiles.length;
                const col = SYNDICATE_COLORS[name] || "#4a9eff";
                const strategy = avgTop > 55 ? "Top-Heavy" : avgTop > 35 ? "Balanced" : avgTop > 15 ? "Spread" : "Bottom-Up";

                return (
                  <div key={name} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #0d1321" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#e8e6e3" }}>{name}</span>
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: strategy === "Top-Heavy" ? "#e6394633" : strategy === "Balanced" ? "#e9c46a33" : strategy === "Spread" ? "#2a9d8f33" : "#6a4c9333", color: strategy === "Top-Heavy" ? "#e63946" : strategy === "Balanced" ? "#e9c46a" : strategy === "Spread" ? "#2a9d8f" : "#6a4c93" }}>{strategy}</span>
                      </div>
                      <div style={{ fontSize: 10, color: totalNet >= 0 ? "#2ecc71" : "#e63946", fontWeight: 600 }}>
                        {totalNet >= 0 ? "+" : ""}${totalNet.toLocaleString()} ({yearsActive}yr)
                      </div>
                    </div>
                    <div style={{ display: "flex", height: 18, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                      {[{pct: avgTop, color: tierColors["1-2"]}, {pct: avgElite, color: tierColors["3-4"]}, {pct: avgMid, color: tierColors["5-8"]}, {pct: avgLow, color: tierColors["9-12"]}, {pct: avgBottom, color: tierColors["13-16"]}].map((seg, i) => (
                        <div key={i} style={{ width: `${seg.pct}%`, background: seg.color, minWidth: seg.pct > 0 ? 1 : 0 }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 9, color: "#5a6a8a" }}>
                      <span>Top: {avgTop.toFixed(0)}%</span>
                      <span>Elite: {avgElite.toFixed(0)}%</span>
                      <span>Mid: {avgMid.toFixed(0)}%</span>
                      <span>Low: {avgLow.toFixed(0)}%</span>
                      <span>Bottom: {avgBottom.toFixed(0)}%</span>
                      <span style={{ color: "#8a9aba" }}>Max bet: {avgConcentration.toFixed(0)}% of budget</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Year-by-year syndicate comparison */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e3", marginBottom: 4 }}>Spending Swings by Syndicate</div>
            <div style={{ fontSize: 10, color: "#5a6a8a", marginBottom: 14 }}>Year-over-year budget changes</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e2a40" }}>
                    <th style={{ padding: "5px 6px", textAlign: "left", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>Syndicate</th>
                    {yearData.map(yd => (
                      <th key={yd.year} style={{ padding: "5px 6px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>{yd.year}</th>
                    ))}
                    <th style={{ padding: "5px 6px", textAlign: "right", color: "#5a6a8a", fontWeight: 500, fontSize: 10 }}>Max Swing</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allNames = [...new Set(yearData.flatMap(yd => Object.keys(yd.synProfiles)))];
                    return allNames.sort().map(name => {
                      const vals = yearData.map(yd => yd.synProfiles[name]?.spent || null);
                      const active = vals.filter(v => v !== null);
                      const maxSwing = active.length > 1 ? Math.max(...active) - Math.min(...active) : 0;
                      return (
                        <tr key={name} style={{ borderBottom: "1px solid #0d1321" }}>
                          <td style={{ padding: "5px 6px", color: SYNDICATE_COLORS[name] || "#8a9aba", fontWeight: 600 }}>{name}</td>
                          {vals.map((v, i) => (
                            <td key={i} style={{ padding: "5px 6px", textAlign: "right", color: v === null ? "#3a4a6a" : "#8a9aba" }}>
                              {v === null ? "—" : `$${v.toLocaleString()}`}
                            </td>
                          ))}
                          <td style={{ padding: "5px 6px", textAlign: "right", color: maxSwing > 2000 ? "#e63946" : maxSwing > 1000 ? "#e9c46a" : "#5a6a8a", fontWeight: 600 }}>
                            ${maxSwing.toLocaleString()}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {spendView === "takeaways" && (
        <div>
          {[
            { title: "The 9th Syndicate Effect", color: "#e63946", content: [
              "Adding Tomek as a 9th syndicate in 2024 inflated the pot by $6,290 (+21.5%). But it wasn't distributed evenly — 70% of the increase ($4,430) went to 1-seeds alone.",
              "More bidders creates a bidding war at the top. 1-seeds went from avg $1,480 → $2,588 (+75%). Meanwhile mid-tier seeds 5-6 actually got CHEAPER as budgets were exhausted.",
              "When Smith left in 2025, spending instantly normalized. 4 years of data confirm: 8-syn pots cluster $29-31K, the 9-syn pot jumped to $35.5K.",
            ]},
            { title: "Top-Heavy Arms Race", color: "#f4a261", content: [
              "In 2024, the top 3 seed lines absorbed $7,280 more than 2023 — exceeding the entire $6,290 pot increase. The rest of the bracket actually deflated.",
              "Top seeds (1-2) consumed 49.7% of the 2024 pot vs 39-40% in 8-syn years (2022/2023/2025). That's half the money on 8 of 64 teams.",
              "The highest single team price nearly doubled: $1,720 (Alabama '23) → $3,350 (UConn '24). Even in 2022, the max was $2,380 (Gonzaga) — well below 2024 levels.",
            ]},
            { title: "The Value Zone Got Cheaper", color: "#2ecc71", content: [
              "Seeds 5-6 dropped from avg $480/$410 to $495/$325 in the 9-syndicate year. When everyone chases the top, the middle gets discounted.",
              "Seeds 5-8 went from 22.5% to 15.0% of the pot in 2024 — a 33% reduction in relative allocation despite being where most tournament runs start.",
              "This is where the value lives. In a 9-syn auction, let others overpay for 1-seeds and target the 5-8 range where prices are softest.",
            ]},
            { title: "Syndicate Strategy Matters", color: "#4a9eff", content: [
              "Top-heavy strategies (Hudachek '24: 61% on 1-2 seeds, Curran '24: 83%) can hit big but are high variance — one bad 1-seed ruins your year.",
              "Spread strategies (Tomek: 0% on top seeds in '24, Hogan: 0% in '24) are safer but cap upside. Hogan spent only $1,800 in 2024 — lowest ever.",
              "Over 4 years, Curran leads with +$6,797 career net. The consistent winners blend both: buy a 1-2 seed but also grab value in the 5-9 range.",
            ]},
            { title: "2026 Auction Implications", color: "#7c5cfc", content: [
              "With 9 syndicates confirmed, expect a ~$35K pot. 1-seed prices will inflate 30-40% above the 8-syn baseline, while 5-6 seeds will deflate.",
              "Watch the first 1-seed that sells — it sets the ceiling. In 2024, once UConn went for $3,350, every other 1-seed was $1,550+.",
              "Your edge: know the EV of each team before the auction. When the bidding war pushes 1-seeds past their fair value, let them go and scoop up the deflated mid-tier.",
            ]},
          ].map(section => (
            <div key={section.title} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: section.color, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: section.color }} />
                {section.title}
              </div>
              {section.content.map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: "#8a9aba", lineHeight: 1.6, marginBottom: 8 }}>{p}</div>
              ))}
            </div>
          ))}
        </div>
      )}
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