import React, { useState } from 'react';
import FPLDashboard from './components/FPLDashboard';
import LeagueAnalysis from './components/LeagueAnalysis';
import FPLMultiGameweekDashboard from './components/FPLMultiGameweekDashboard';
import FPLPositionChart from './components/FPLPositionChart';
import './App.css';

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⚽' },
   // { id: 'analysis', label: 'Analysis', icon: '🧠' },
    { id: 'multi-gw', label: 'Multi-GW', icon: '📊' },
    { id: 'position-chart', label: 'Positions', icon: '📈' },
  ];

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="w-full px-3 md:px-6">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo - smaller on mobile */}
          <div className="text-lg md:text-xl font-bold text-cyan-400 flex-shrink-0">
            ⚽ BPL Hub
          </div>
          
          {/* Navigation */}
          <div className="flex space-x-1 md:space-x-4 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`px-2 py-2 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  currentPage === item.id
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span className="mr-1 md:mr-2">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
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
    <div className="min-h-screen bg-slate-900 text-gray-100">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="w-full px-3 py-4 md:px-6 md:py-6">
        <div className="max-w-7xl mx-auto">
          {renderCurrentPage()}
        </div>
      </main>
    </div>
  );
}

export default App;