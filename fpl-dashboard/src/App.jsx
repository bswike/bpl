import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Trophy, Table2 } from 'lucide-react';
import FPLDashboard from './components/FPLDashboard';
import LeagueAnalysis from './components/LeagueAnalysis';
import FPLMultiGameweekDashboard from './components/FPLMultiGameweekDashboard';
import FPLPositionChart from './components/FPLPositionChart';
import OverallLeaderboard from './components/OverallLeaderboard';
import './App.css';

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'position-chart', label: 'Positions', Icon: TrendingUp },
    { id: 'multi-gw', label: 'Stats', Icon: BarChart3 },
    { id: 'standings', label: 'Standings', Icon: Trophy },
    { id: 'dashboard', label: 'Table', Icon: Table2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="border-t border-gray-800/60 bg-gray-950/98 backdrop-blur-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`relative flex flex-col items-center justify-center py-3 px-4 min-w-[72px] transition-colors duration-150 ${
                    isActive
                      ? 'text-cyan-400'
                      : 'text-gray-500 hover:text-gray-300 active:text-gray-200'
                  }`}
                >
                  {/* Top accent line for active tab */}
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200 ${
                    isActive ? 'w-8 bg-cyan-400' : 'w-0 bg-transparent'
                  }`} />
                  
                  {/* Icon */}
                  <item.Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className="mb-1"
                  />
                  
                  {/* Label */}
                  <span className={`text-[11px] font-medium tracking-tight ${
                    isActive ? 'text-cyan-400' : 'text-gray-500'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* iOS home indicator space */}
        <div className="h-safe-bottom" />
      </div>
    </nav>
  );
};

function App() {
  // Default to multi-gw immediately (no blocking)
  const [currentPage, setCurrentPage] = useState('multi-gw');
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  // Check GW status in background (non-blocking)
  useEffect(() => {
    if (hasCheckedStatus) return;
    
    const checkStatus = async () => {
      try {
        const res = await fetch('https://bpl-red-sun-894.fly.dev/api/gameweek-status');
        if (res.ok) {
          const data = await res.json();
          // Only auto-switch if GW is NOT active (show standings)
          if (!data.is_active) {
            setCurrentPage('standings');
          }
        }
      } catch (err) {
        // Silently fail - just stay on current page
        console.log('GW status check failed, using default view');
      } finally {
        setHasCheckedStatus(true);
      }
    };
    
    checkStatus();
  }, [hasCheckedStatus]);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <FPLDashboard />;
      case 'multi-gw':
        return <FPLMultiGameweekDashboard />;
      case 'position-chart':
        return <FPLPositionChart />;
      case 'standings':
        return <OverallLeaderboard />;
      default:
        return <FPLMultiGameweekDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 pb-20">
      <main className="w-full px-3 py-4 md:px-6 md:py-6">
        <div className="max-w-7xl mx-auto">
          {renderCurrentPage()}
        </div>
      </main>
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
}

export default App;