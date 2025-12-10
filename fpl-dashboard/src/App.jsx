import React, { useState, useEffect } from 'react';
import FPLDashboard from './components/FPLDashboard';
import LeagueAnalysis from './components/LeagueAnalysis';
import FPLMultiGameweekDashboard from './components/FPLMultiGameweekDashboard';
import FPLPositionChart from './components/FPLPositionChart';
import OverallLeaderboard from './components/OverallLeaderboard';
import './App.css';

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'position-chart', label: 'Positions', icon: '📈' },
    { id: 'multi-gw', label: 'Stats', icon: '🔢' },
    { id: 'standings', label: 'Standings', icon: '🏆' },
    { id: 'dashboard', label: 'Table', icon: '📊' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* Backdrop blur container */}
      <div className="relative border-t border-gray-800/50 bg-gray-900/95 backdrop-blur-xl shadow-2xl">
        <div className="max-w-md mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`relative flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] py-2 px-3 rounded-xl transition-all duration-200 ${
                  currentPage === item.id
                    ? 'text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300 active:scale-95'
                }`}
              >
                {/* Active indicator */}
                {currentPage === item.id && (
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-xl" />
                )}
                
                {/* Icon */}
                <div className={`relative text-lg sm:text-xl mb-0.5 transition-transform duration-200 ${
                  currentPage === item.id ? 'scale-110' : ''
                }`}>
                  {item.icon}
                </div>
                
                {/* Label */}
                <span className={`relative text-[10px] sm:text-xs font-medium transition-all duration-200 ${
                  currentPage === item.id ? 'opacity-100' : 'opacity-70'
                }`}>
                  {item.label}
                </span>
                
                {/* Active dot indicator */}
                {currentPage === item.id && (
                  <div className="absolute -bottom-0.5 w-1 h-1 bg-cyan-400 rounded-full" />
                )}
              </button>
            ))}
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