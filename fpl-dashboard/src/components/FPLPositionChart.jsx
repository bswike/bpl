import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import Papa from 'papaparse';

const FPLPositionChart = () => {
  const [chartData, setChartData] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Color palette for different managers
  const colors = [
    '#00FFFF', '#FF0040', '#FFFF00', '#00FF00', '#FF8000', 
    '#FF00FF', '#FFFFFF', '#8000FF', '#0080FF', '#FF4080',
    '#80FF00', '#FF8040', '#4080FF', '#FF0080', '#80FF80',
    '#FF4040', '#4040FF', '#40FF40', '#FF8080', '#8080FF'
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white p-3 rounded border border-gray-600 shadow-xl">
          <p className="font-bold text-cyan-300">Gameweek {label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey}: Position {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props) => {
    const { cx, cy, payload, dataKey, fill } = props;
    if (payload && dataKey) {
      const initials = dataKey.split(' ').map(name => name[0]).join('').substring(0, 2).toUpperCase();
      
      // Determine text color based on background - use black text for light colors
      const isLightColor = (color) => {
        const lightColors = ['#FFFF00', '#FFFFFF', '#00FFFF', '#00FF00', '#80FF00', '#80FF80', '#FF8080'];
        return lightColors.includes(color);
      };
      
      const textColor = isLightColor(fill) ? '#000000' : '#FFFFFF';
      
      return (
        <g>
          <circle 
            cx={cx} 
            cy={cy} 
            r={12} 
            fill={fill} 
            stroke="#333333" 
            strokeWidth={2}
          />
          <text 
            x={cx} 
            y={cy + 2} 
            textAnchor="middle" 
            fill={textColor}
            fontSize="9" 
            fontWeight="bold"
          >
            {initials}
          </text>
        </g>
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill={fill} />;
  };

  const processGameweekData = async (gameweek) => {
try {
      // Fetch from Vercel Blob (your Fly worker overwrites this file every 5 minutes)
      const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gameweek}.csv`;
      // tiny cache-buster tied to 5min intervals
      const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

      const csvData = await response.text();
      
      // Check if the game is being updated
      if (csvData.trim() === "The game is being updated.") {
        console.log(`GW${gameweek} is being updated, returning empty data`);
        return [];
      }

      const parsed = Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      console.log(`GW${gameweek} parsed rows:`, parsed.data.length);

      // Get total points for each manager
      const totalRows = parsed.data.filter(row => row.player === "TOTAL");
      console.log(`GW${gameweek} total rows found:`, totalRows.length);
      
      return totalRows.map(row => ({
        manager_name: row.manager_name,
        total_points: row.points_applied,
        gameweek: gameweek
      }));

    } catch (error) {
      console.error(`Error processing GW${gameweek}:`, error);
      throw error;
    }
  };

  const fetchData = async () => {
    try {
      setError(null);
      console.log('Starting to fetch data...');
      
      const [gw1Data, gw2Data] = await Promise.all([
        processGameweekData(1),
        processGameweekData(2)
      ]);

      console.log('GW1 data:', gw1Data.length, 'managers');
      console.log('GW2 data:', gw2Data.length, 'managers');

      if (gw1Data.length === 0) {
        throw new Error('No GW1 data found');
      }

      // Create cumulative points data
      const cumulativeData = gw1Data.map(gw1Manager => {
        const gw2Manager = gw2Data.find(m => m.manager_name === gw1Manager.manager_name);
        
        return {
          manager_name: gw1Manager.manager_name,
          gw1_cumulative: gw1Manager.total_points, // Just GW1 points
          gw2_cumulative: gw1Manager.total_points + (gw2Manager ? gw2Manager.total_points : 0) // GW1 + GW2 combined
        };
      });

      console.log('Cumulative data calculated for', cumulativeData.length, 'managers');

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

      console.log('Ranked by cumulative points - GW1:', gw1Ranked.length, 'GW2:', gw2Ranked.length);

      // Create chart data structure
      const allManagers = gw1Ranked.map(m => m.manager_name);
      setManagers(allManagers);
      console.log('All managers:', allManagers);

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

      console.log('Chart data created:', chartPoints);
      setChartData(chartPoints);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900">
        <div className="text-cyan-400 text-xl animate-pulse">Loading position data...</div>
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
            Check console for more details. Make sure both CSV files are uploaded.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-xl p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-2xl font-bold text-white mb-2">
          BPL POSITION CHART - GW1 to GW2
        </h1>
        <div className="flex justify-between text-xs md:text-sm text-gray-400">
          <span>GAMEWEEK: 1-2</span>
          <span>MANAGERS: {managers.length}</span>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="gameweek" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[1, 2]}
              type="number"
              ticks={[1, 2]}
              label={{ value: 'Gameweek', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[1, managers.length]}
              reversed={true}
              label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
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
            margin={{ top: 30, right: 30, left: 30, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="gameweek" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 14 }}
              domain={[1, 2]}
              type="number"
              ticks={[1, 2]}
              label={{ value: 'Gameweek', position: 'insideBottom', offset: -20, fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 14 }}
              domain={[1, managers.length]}
              reversed={true}
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
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 text-xs text-gray-400">
        <p>Positions based on cumulative points: GW1 shows total after 1 gameweek, GW2 shows total after 2 gameweeks.</p>
        {chartData.length < 2 && (
          <p className="text-yellow-400">GW2 data not yet available - showing GW1 positions only</p>
        )}
      </div>
    </div>
  );
};

export default FPLPositionChart;