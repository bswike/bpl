import React, { useState } from 'react';
import FPLDashboard from './components/FPLDashboard';
import LeagueAnalysis from './components/LeagueAnalysis';
import './App.css';

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⚽' },
    { id: 'analysis', label: 'League Analysis', icon: '🧠' },
  ];

  return (
    <nav className="bg-slate-800 border-b border-slate-700 mb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="text-xl font-bold text-cyan-400">⚽ BPL League Hub</div>
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-cyan-600 text-white shadow-lg'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <FPLDashboard />;
      case 'analysis':
        return <LeagueAnalysis />;
      default:
        return <FPLDashboard />;
    }
  };

  return (
  <div className="min-h-screen bg-slate-900 text-gray-100" style={{margin: 0, padding: 0}}>
    <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
    <div className="max-w-7xl mx-auto" style={{padding: 0}}>
      {renderCurrentPage()}
    </div>
  </div>
  );
}

export default App;