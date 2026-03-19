import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TrendingUp, BarChart3, Trophy, Table2, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { DataProvider, useData } from './context/DataContext';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load components for code splitting - only loads when tab is clicked
const FPLMultiGameweekDashboard = lazy(() => import('./components/FPLMultiGameweekDashboard'));
const OverallLeaderboard = lazy(() => import('./components/OverallLeaderboard'));
const FPLDashboard = lazy(() => import('./components/FPLDashboard'));
const FPLPositionChart = lazy(() => import('./components/FPLPositionChart'));
const FPLCup = lazy(() => import('./components/FPLCup'));

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'position-chart', label: 'Positions', Icon: TrendingUp },
    { id: 'multi-gw', label: 'Weekly', Icon: BarChart3 },
    { id: 'standings', label: 'Table', Icon: Trophy },
    { id: 'cup', label: 'Cup', Icon: Award },
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

function CalcuttaSplash({ onDismiss }) {
  const navigate = useNavigate();
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "linear-gradient(135deg, #0d1321 0%, #1a2744 100%)",
        border: "1px solid #1e2a40", borderRadius: 16,
        padding: "36px 28px", maxWidth: 380, width: "100%",
        textAlign: "center", boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 42, marginBottom: 8 }}>🏀</div>
        <h2 style={{
          color: "#e8e6e3", fontSize: 22, fontWeight: 700,
          margin: "0 0 6px", letterSpacing: "-0.02em",
        }}>It's March.</h2>
        <p style={{ color: "#8a9aba", fontSize: 14, margin: "0 0 28px" }}>
          Looking for the Hogan Calcutta?
        </p>
        <button
          onClick={() => navigate("/calcutta")}
          style={{
            display: "block", width: "100%", padding: "14px 0",
            background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            color: "#fff", fontWeight: 700, fontSize: 16,
            border: "none", borderRadius: 10, cursor: "pointer",
            marginBottom: 12, letterSpacing: "0.02em",
          }}
        >
          Take me to Calcutta →
        </button>
        <button
          onClick={onDismiss}
          style={{
            display: "block", width: "100%", padding: "12px 0",
            background: "transparent", color: "#5a6a8a",
            fontWeight: 500, fontSize: 13, border: "1px solid #1e2a40",
            borderRadius: 10, cursor: "pointer",
          }}
        >
          Proceed to Soccer
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { gwStatus, isInitialLoading } = useData();
  const [currentPage, setCurrentPage] = useState(null);
  const [hasSetInitialPage, setHasSetInitialPage] = useState(false);
  const [componentLoaded, setComponentLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Set initial page immediately - default to Weekly, will update once gwStatus loads
  useEffect(() => {
    if (hasSetInitialPage) return;
    
    // Set default page immediately to avoid waiting for DataContext
    if (!currentPage) {
      setCurrentPage('multi-gw'); // Default to Weekly tab
    }
    
    // Once gwStatus loads, update if needed (only matters for finished GWs)
    if (gwStatus && !isInitialLoading) {
      const isActive = gwStatus?.current_gameweek && !gwStatus.current_gameweek.finished;
      if (!isActive && currentPage === 'multi-gw') {
        setCurrentPage('standings');
      }
      setHasSetInitialPage(true);
    }
  }, [gwStatus, isInitialLoading, hasSetInitialPage, currentPage]);

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
      case 'cup':
        return <FPLCup />;
      default:
        return <FPLMultiGameweekDashboard />;
    }
  };

  // Don't show a separate loading screen for DataContext
  // Let the individual components handle their own loading
  // This avoids multiple loading screens appearing in sequence
  if (!currentPage) {
    return <LoadingSpinner fullScreen size="lg" />;
  }

  return (
    <Suspense fallback={<LoadingSpinner fullScreen size="lg" />}>
      {showSplash && <CalcuttaSplash onDismiss={() => setShowSplash(false)} />}
      <div className="min-h-screen bg-slate-900 text-gray-100 pb-20">
        <main className="w-full px-3 py-4 md:px-6 md:py-6">
          <div className="max-w-7xl mx-auto">
            {renderCurrentPage()}
          </div>
        </main>
        <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
      </div>
    </Suspense>
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