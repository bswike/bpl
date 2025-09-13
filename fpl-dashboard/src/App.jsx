import React, { useState } from 'react';
import FPLDashboard from './components/FPLDashboard';
import LeagueAnalysis from './components/LeagueAnalysis';
import FPLMultiGameweekDashboard from './components/FPLMultiGameweekDashboard';
import FPLPositionChart from './components/FPLPositionChart';
import './App.css';

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'position-chart', label: 'Positions', icon: '📈' },
    { id: 'multi-gw', label: 'GW Stats', icon: '🔢' },
    { id: 'dashboard', label: 'League Table', icon: '📊' },
   // { id: 'analysis', label: 'Analysis', icon: '🧠' },
    
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/90 to-transparent backdrop-blur-2xl" />
      
      {/* Main navigation container */}
      <div className="relative px-6 py-3">
        <div className="flex justify-center">
          <div className="flex bg-gray-900/80 backdrop-blur-xl rounded-2xl p-2 border border-gray-700/50 shadow-2xl">
            {navItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`relative flex flex-col items-center px-6 py-3 mx-1 rounded-xl transition-all duration-300 ease-out group ${
                  currentPage === item.id
                    ? 'bg-gradient-to-b from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25 transform scale-105'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                {/* Active indicator dot */}
                {currentPage === item.id && (
                  <div className="absolute -top-1 w-1 h-1 bg-white rounded-full opacity-80" />
                )}
                
                {/* Icon container */}
                <div className={`w-6 h-6 mb-1 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  currentPage === item.id 
                    ? 'bg-white/20 shadow-inner' 
                    : 'bg-transparent group-hover:bg-gray-700/40'
                }`}>
                  <span className="text-sm font-medium">{item.icon}</span>
                </div>
                
                {/* Label */}
                <span className="text-xs font-medium tracking-wide">
                  {item.label}
                </span>
                
                {/* Subtle glow effect for active item */}
                {currentPage === item.id && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-cyan-400/10 to-transparent pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Home indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-32 h-1 bg-white/20 rounded-full" />
        </div>
      </div>
    </nav>
  );
};

function App() {
  const [currentPage, setCurrentPage] = useState('multi-gw');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <FPLDashboard />;
      /*case 'analysis':
        return <LeagueAnalysis />;*/
      case 'multi-gw':
        return <FPLMultiGameweekDashboard />;
      case 'position-chart':
        return <FPLPositionChart />;
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