import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TrendingUp, BarChart3, Trophy, Table2 } from 'lucide-react';
import './App.css';
import { DataProvider, useData } from './context/DataContext';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load components for code splitting - only loads when tab is clicked
const FPLMultiGameweekDashboard = lazy(() => import('./components/FPLMultiGameweekDashboard'));
const OverallLeaderboard = lazy(() => import('./components/OverallLeaderboard'));
const FPLDashboard = lazy(() => import('./components/FPLDashboard'));
const FPLPositionChart = lazy(() => import('./components/FPLPositionChart'));

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'position-chart', label: 'Positions', Icon: TrendingUp },
    { id: 'multi-gw', label: 'Weekly', Icon: BarChart3 },
    { id: 'standings', label: 'Table', Icon: Trophy },
    { id: 'dashboard', label: 'Chips', Icon: Table2 },
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

// Inner app component that uses the data context
function AppContent() {
  const { gwStatus, isInitialLoading } = useData();
  const [currentPage, setCurrentPage] = useState(null);
  const [hasSetInitialPage, setHasSetInitialPage] = useState(false);

  // Set initial page based on GW status (only once after data loads)
  useEffect(() => {
    if (hasSetInitialPage || isInitialLoading) return;
    
    // GW is "active" if current_gameweek exists and is NOT finished
    const isActive = gwStatus?.current_gameweek && !gwStatus.current_gameweek.finished;
    // Show Weekly during live action, Standings when GW is finished
    setCurrentPage(isActive ? 'multi-gw' : 'standings');
    setHasSetInitialPage(true);
  }, [gwStatus, isInitialLoading, hasSetInitialPage]);

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

  // Show loading while data context is initializing
  if (isInitialLoading || !currentPage) {
    return <LoadingSpinner fullScreen size="lg" />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 pb-20">
      <main className="w-full px-3 py-4 md:px-6 md:py-6">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={<LoadingSpinner fullScreen size="lg" />}>
            {renderCurrentPage()}
          </Suspense>
        </div>
      </main>
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
}

// Main App component wraps everything with DataProvider
function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

export default App;