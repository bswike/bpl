import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceArea } from ‘recharts’;
import Papa from 'papaparse';

const FPLPositionChart = () => {
const [chartData, setChartData] = useState([]);
const [managers, setManagers] = useState([]);
const [managerStats, setManagerStats] = useState({});
const [benchData, setBenchData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [selectedManager, setSelectedManager] = useState(null);

// Color palette for different managers
const colors = [
'#00FFFF', '#FF0040', '#FFFF00', '#00FF00', '#FF8000',
'#FF00FF', '#FFFFFF', '#8000FF', '#0080FF', '#FF4080',
'#80FF00', '#FF8040', '#4080FF', '#FF0080', '#80FF80',
'#FF4040', '#4040FF', '#40FF40', '#FF8080', '#8080FF'
];

const CustomTooltip = ({ active, payload, label }) => {
if (active && payload && payload.length && selectedManager) {
// Only show the selected manager’s data
const managerData = payload.find(entry => entry.dataKey === selectedManager);
if (managerData && managerStats[selectedManager]) {
const stats = managerStats[selectedManager];
const currentGW = parseInt(label);
const currentRank = managerData.value;

```
    let previousRank = null;
    let totalPoints = null;
    
    if (currentGW === 1) {
      totalPoints = stats.gw1_cumulative;
    } else if (currentGW === 2) {
      previousRank = stats.gw1_position;
      totalPoints = stats.gw2_cumulative;
    } else if (currentGW === 3) {
      previousRank = stats.gw2_position;
      totalPoints = stats.gw3_cumulative;
    }
    
    const rankChange = previousRank ? currentRank - previousRank : null;
    const rankChangeText = rankChange === null ? '' : 
      rankChange === 0 ? ' (No change)' :
      rankChange > 0 ? ` (↓${rankChange})` : 
      ` (↑${Math.abs(rankChange)})`;
    
    return (
      <div className="bg-gray-900 text-white p-3 rounded border border-gray-600 shadow-xl min-w-48">
        <p className="font-bold text-cyan-300 mb-2">{selectedManager}</p>
        <p className="text-sm mb-1">Gameweek: {label}</p>
        <p className="text-sm mb-1">Current Rank: #{currentRank}{rankChangeText}</p>
        {previousRank && (
          <p className="text-sm mb-1">Previous Rank: #{previousRank}</p>
        )}
        <p className="text-sm font-semibold" style={{ color: managerData.color }}>
          Total Points: {totalPoints}
        </p>
      </div>
    );
  }
}
return null;
```

};

const CustomDot = (props) => {
const { cx, cy, payload, dataKey, fill } = props;
if (payload && dataKey) {
const initials = dataKey.split(’ ‘).map(name => name[0]).join(’’).substring(0, 2).toUpperCase();

```
  // Determine text color based on background - use black text for light colors
  const isLightColor = (color) => {
    const lightColors = ['#FFFF00', '#FFFFFF', '#00FFFF', '#00FF00', '#80FF00', '#80FF80', '#FF8080'];
    return lightColors.includes(color);
  };
  
  const textColor = isLightColor(fill) ? '#000000' : '#FFFFFF';
  const isSelected = selectedManager === dataKey;
  
  return (
    <g>
      <circle 
        cx={cx} 
        cy={cy} 
        r={isSelected ? 16 : 12} 
        fill={fill} 
        stroke={isSelected ? "#FFD700" : "#333333"} 
        strokeWidth={isSelected ? 3 : 2}
        style={{ cursor: 'pointer' }}
        onClick={() => setSelectedManager(dataKey)}
      />
      <text 
        x={cx} 
        y={cy + 2} 
        textAnchor="middle" 
        fill={textColor}
        fontSize={isSelected ? "10" : "9"}
        fontWeight="bold"
        style={{ cursor: 'pointer', pointerEvents: 'none' }}
      >
        {initials}
      </text>
    </g>
  );
}
return <circle cx={cx} cy={cy} r={4} fill={fill} />;
```

};

const processGameweekData = async (gameweek) => {
try {
// Fetch from Vercel Blob (your Fly worker overwrites this file every 5 minutes)
const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gameweek}.csv`;
// tiny cache-buster tied to 5min intervals
const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;

```
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

  const csvData = await response.text();
  
  // Check if the game is being updated
  if (csvData.trim() === "The game is being updated.") {
    console.log(`GW${gameweek} is being updated, returning empty data`);
    return { totals: [], bench: [] };
  }

  const parsed = Papa.parse(csvData, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  console.log(`GW${gameweek} parsed rows:`, parsed.data.length);

  // Get total points for each manager and calculate bench points
  const totalRows = parsed.data.filter(row => row.player === "TOTAL");
  
  // Calculate bench points (players with multiplier = 0)
  const benchPlayers = parsed.data.filter(row => 
    row.multiplier === 0 && 
    row.player !== "TOTAL" && 
    row.points_gw > 0
  );
  
  // Group bench points by manager
  const benchPointsByManager = {};
  benchPlayers.forEach(player => {
    if (!benchPointsByManager[player.manager_name]) {
      benchPointsByManager[player.manager_name] = 0;
    }
    benchPointsByManager[player.manager_name] += player.points_gw;
  });
  
  console.log(`GW${gameweek} total rows found:`, totalRows.length);
  console.log(`GW${gameweek} bench players found:`, benchPlayers.length);
  
  return {
    totals: totalRows.map(row => ({
      manager_name: row.manager_name,
      total_points: row.points_applied,
      gameweek: gameweek
    })),
    bench: Object.entries(benchPointsByManager).map(([manager_name, bench_points]) => ({
      manager_name,
      bench_points,
      gameweek: gameweek
    }))
  };

} catch (error) {
  console.error(`Error processing GW${gameweek}:`, error);
  throw error;
}
```

};

const fetchData = async () => {
try {
setError(null);
console.log(‘Starting to fetch data…’);

```
  const [gw1Data, gw2Data, gw3Data] = await Promise.all([
    processGameweekData(1),
    processGameweekData(2),
    processGameweekData(3)
  ]);

  console.log('GW1 data:', gw1Data.totals.length, 'managers');
  console.log('GW2 data:', gw2Data.totals.length, 'managers');
  console.log('GW3 data:', gw3Data.totals.length, 'managers');

  if (gw1Data.totals.length === 0) {
    throw new Error('No GW1 data found');
  }

  // Create cumulative points data
  const cumulativeData = gw1Data.totals.map(gw1Manager => {
    const gw2Manager = gw2Data.totals.find(m => m.manager_name === gw1Manager.manager_name);
    const gw3Manager = gw3Data.totals.find(m => m.manager_name === gw1Manager.manager_name);
    
    return {
      manager_name: gw1Manager.manager_name,
      gw1_cumulative: gw1Manager.total_points,
      gw2_cumulative: gw1Manager.total_points + (gw2Manager ? gw2Manager.total_points : 0),
      gw3_cumulative: gw1Manager.total_points + (gw2Manager ? gw2Manager.total_points : 0) + (gw3Manager ? gw3Manager.total_points : 0)
    };
  });

  // Calculate bench points
  const benchPoints = gw1Data.totals.map(manager => {
    const gw1Bench = gw1Data.bench.find(b => b.manager_name === manager.manager_name)?.bench_points || 0;
    const gw2Bench = gw2Data.bench.find(b => b.manager_name === manager.manager_name)?.bench_points || 0;
    const gw3Bench = gw3Data.bench.find(b => b.manager_name === manager.manager_name)?.bench_points || 0;
    
    return {
      manager_name: manager.manager_name,
      total_bench_points: gw1Bench + gw2Bench + gw3Bench,
      gw1_bench: gw1Bench,
      gw2_bench: gw2Bench,
      gw3_bench: gw3Bench
    };
  });

  // Sort bench points for leaderboard (highest first - they're the "winners" of bench points lol)
  const sortedBenchData = benchPoints
    .sort((a, b) => b.total_bench_points - a.total_bench_points)
    .slice(0, 10); // Top 10 bench point "achievers"
  
  setBenchData(sortedBenchData);

  console.log('Cumulative data calculated for', cumulativeData.length, 'managers');
  console.log('Bench data calculated for', benchPoints.length, 'managers');

  // Rank managers for each gameweek based on cumulative points
  const gw1Ranked = [...cumulativeData]
    .sort((a, b) => b.gw1_cumulative - a.gw1_cumulative)
    .map((manager, index) => ({
      ...manager,
      gw1_position: index + 1
    }));

  const gw2Ranked = [...cumulativeData]
    .sort((a, b) => b.gw2_cumulative - a.gw2_cumulative)
    .map((manager, index) => ({
      ...manager,
      gw2_position: index + 1
    }));

  const gw3Ranked = [...cumulativeData]
    .sort((a, b) => b.gw3_cumulative - a.gw3_cumulative)
    .map((manager, index) => ({
      ...manager,
      gw3_position: index + 1
    }));

  console.log('Ranked by cumulative points - GW1:', gw1Ranked.length, 'GW2:', gw2Ranked.length, 'GW3:', gw3Ranked.length);

  // Create chart data structure and manager stats
  const allManagers = gw1Ranked.map(m => m.manager_name);
  setManagers(allManagers);
  console.log('All managers:', allManagers);

  // Store manager stats for tooltip use
  const statsLookup = {};
  gw1Ranked.forEach(manager => {
    const gw2Manager = gw2Ranked.find(m => m.manager_name === manager.manager_name);
    const gw3Manager = gw3Ranked.find(m => m.manager_name === manager.manager_name);
    statsLookup[manager.manager_name] = {
      gw1_position: manager.gw1_position,
      gw1_cumulative: manager.gw1_cumulative,
      gw2_position: gw2Manager ? gw2Manager.gw2_position : null,
      gw2_cumulative: gw2Manager ? gw2Manager.gw2_cumulative : manager.gw1_cumulative,
      gw3_position: gw3Manager ? gw3Manager.gw3_position : null,
      gw3_cumulative: gw3Manager ? gw3Manager.gw3_cumulative : (gw2Manager ? gw2Manager.gw2_cumulative : manager.gw1_cumulative)
    };
  });
  setManagerStats(statsLookup);

  const chartPoints = [];

  // GW1 positions (based on GW1 points only)
  const gw1Point = { gameweek: 1 };
  gw1Ranked.forEach(manager => {
    gw1Point[manager.manager_name] = manager.gw1_position;
  });
  chartPoints.push(gw1Point);

  // GW2 positions (based on GW1+GW2 cumulative points)
  const gw2Point = { gameweek: 2 };
  gw2Ranked.forEach(manager => {
    gw2Point[manager.manager_name] = manager.gw2_position;
  });
  chartPoints.push(gw2Point);

  // GW3 positions (based on GW1+GW2+GW3 cumulative points)
  if (gw3Data.totals.length > 0) {
    const gw3Point = { gameweek: 3 };
    gw3Ranked.forEach(manager => {
      gw3Point[manager.manager_name] = manager.gw3_position;
    });
    chartPoints.push(gw3Point);
  }

  console.log('Chart data created:', chartPoints);
  setChartData(chartPoints);
} catch (error) {
  console.error('Error loading data:', error);
  setError(error.message);
} finally {
  setLoading(false);
}
```

};

useEffect(() => {
fetchData();
}, []);

const hasGW3Data = chartData.length >= 3;
const maxGameweek = hasGW3Data ? 3 : 2;
const gameweekRange = hasGW3Data ? “GW1 to GW3” : “GW1 to GW2”;

if (loading) {
return (
<div className="flex items-center justify-center h-96 bg-slate-900">
<div className="text-cyan-400 text-xl animate-pulse">Loading position data…</div>
</div>
);
}

if (error) {
return (
<div className="flex items-center justify-center h-96 bg-slate-900">
<div className="text-red-400 text-center">
<div className="text-xl mb-2">Error loading data</div>
<div className="text-sm">{error}</div>
<div className="text-xs mt-4 text-gray-400">
Check console for more details. Make sure all CSV files are uploaded.
</div>
</div>
</div>
);
}

return (
<div className="bg-black rounded-lg overflow-hidden shadow-xl p-4 md:p-6">
<div className="mb-4 md:mb-6">
<h1 className="text-lg md:text-2xl font-bold text-white mb-2">
BPL POSITION CHART - {gameweekRange}
</h1>
<div className="flex justify-between text-xs md:text-sm text-gray-400">
<span>GAMEWEEK: 1-{maxGameweek}</span>
<span>MANAGERS: {managers.length}</span>
</div>
{selectedManager && (
<div className="mt-2 flex items-center justify-between">
<span className="text-cyan-300 text-sm">
Selected: {selectedManager}
</span>
<button
onClick={() => setSelectedManager(null)}
className=“text-red-400 hover:text-red-300 text-sm”
>
Clear
</button>
</div>
)}
</div>

```
  {/* Mobile Layout */}
  <div className="md:hidden">
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={chartData}
        margin={{ top: 20, right: 15, left: 5, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
        
        {/* Create alternating background stripes using ReferenceArea */}
        {Array.from({length: managers.length}, (_, i) => {
          const position = i + 1;
          const isEven = position % 2 === 1; // Position 1,3,5... get lighter gray
          const y1 = position - 0.5;
          const y2 = position + 0.5;
          
          return (
            <ReferenceArea
              key={`ref-area-${position}`}
              y1={y1}
              y2={y2}
              fill={isEven ? '#374151' : '#1F2937'}
              fillOpacity={0.3}
            />
          );
        })}
        
        <XAxis 
          dataKey="gameweek" 
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          domain={[1, maxGameweek]}
          type="number"
          ticks={hasGW3Data ? [1, 2, 3] : [1, 2]}
          label={{ value: 'Gameweek', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
        />
        <YAxis 
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 6 }}
          domain={[1, managers.length]}
          reversed={true}
          tickMargin={4}
          width={20}
          ticks={[1, 5, 10, 15, 20]}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {managers.map((manager, index) => (
          <Line
            key={manager}
            type="linear"
            dataKey={manager}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={<CustomDot fill={colors[index % colors.length]} />}
            activeDot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>

  {/* Desktop Layout */}
  <div className="hidden md:block">
    <ResponsiveContainer width="100%" height={600}>
      <LineChart
        data={chartData}
        margin={{ top: 30, right: 30, left: 50, bottom: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
        
        {/* Create alternating background stripes using ReferenceArea */}
        {Array.from({length: managers.length}, (_, i) => {
          const position = i + 1;
          const isEven = position % 2 === 1; // Position 1,3,5... get lighter gray
          const y1 = position - 0.5;
          const y2 = position + 0.5;
          
          return (
            <ReferenceArea
              key={`ref-area-desktop-${position}`}
              y1={y1}
              y2={y2}
              fill={isEven ? '#374151' : '#1F2937'}
              fillOpacity={0.3}
            />
          );
        })}
        
        <XAxis 
          dataKey="gameweek" 
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 14 }}
          domain={[1, maxGameweek]}
          type="number"
          ticks={hasGW3Data ? [1, 2, 3] : [1, 2]}
          label={{ value: 'Gameweek', position: 'insideBottom', offset: -20, fill: '#9CA3AF' }}
        />
        <YAxis 
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 14 }}
          domain={[1, managers.length]}
          reversed={true}
          tickMargin={10}
          width={45}
          label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {managers.map((manager, index) => (
          <Line
            key={manager}
            type="linear"
            dataKey={manager}
            stroke={colors[index % colors.length]}
            strokeWidth={3}
            dot={<CustomDot fill={colors[index % colors.length]} />}
            activeDot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>

  {/* Instructions and Legend */}
  <div className="mt-4 text-xs text-gray-400 space-y-2">
    <p className="text-cyan-300">Click on any dot to see only that manager's details</p>
    <p>Positions based on cumulative points: GW1 shows total after 1 gameweek, GW2 shows total after 2 gameweeks{hasGW3Data ? ', GW3 shows total after 3 gameweeks' : ''}.</p>
    {!hasGW3Data && (
      <p className="text-yellow-400">GW3 data not yet available - showing GW1-GW2 positions only</p>
    )}
  </div>

  {/* Bench Points Leaderboard */}
  {benchData.length > 0 && (
    <div className="mt-8 bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-lg p-3 md:p-4 border border-red-500/20">
      <div className="text-center mb-3 md:mb-4">
        <h2 className="text-lg md:text-xl font-bold text-red-400 mb-1">
          BENCH CHAMPION
        </h2>
      </div>

      <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {benchData.map((manager, index) => {
          const trophies = ['🏆', '🥈', '🥉'];
          const trophy = index < 3 ? trophies[index] : '';
          const bgColor = index === 0 ? 'bg-red-600/20' : 
                         index === 1 ? 'bg-orange-600/20' : 
                         index === 2 ? 'bg-yellow-600/20' : 'bg-gray-800/20';
          
          return (
            <div 
              key={manager.manager_name} 
              className={`${bgColor} border border-red-400/30 rounded-lg p-2 md:p-3 flex items-center justify-between`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm md:text-lg flex-shrink-0">{trophy}</span>
                <span className="font-mono text-xs md:text-sm text-gray-400 flex-shrink-0">#{index + 1}</span>
                <span className="text-white font-medium text-xs md:text-sm truncate">{manager.manager_name}</span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-red-300 font-bold text-sm md:text-lg">
                  {manager.total_bench_points}
                </div>
                <div className="text-xs text-gray-400">
                  ({manager.gw1_bench} + {manager.gw2_bench}{manager.gw3_bench > 0 ? ` + ${manager.gw3_bench}` : ''})
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )}
</div>
```

);
};

export default FPLPositionChart;
