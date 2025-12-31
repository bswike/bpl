import React from 'react';

/**
 * Unified loading spinner component used across the app
 * @param {number} progress - Optional progress percentage (0-100)
 * @param {string} message - Optional message to display below spinner
 * @param {string} size - 'sm' | 'md' | 'lg' (default: 'md')
 * @param {boolean} fullScreen - Whether to center in full viewport
 */
const LoadingSpinner = ({ progress = null, message = null, size = 'md', fullScreen = false }) => {
  const sizeConfig = {
    sm: { container: 'w-12 h-12', stroke: 4, text: 'text-xs' },
    md: { container: 'w-20 h-20', stroke: 8, text: 'text-lg' },
    lg: { container: 'w-20 h-20', stroke: 8, text: 'text-lg' }, // Same as md for consistency
  };
  
  const config = sizeConfig[size] || sizeConfig.md;
  const showProgress = progress !== null && progress >= 0;
  const strokeDasharray = showProgress ? `${progress * 2.51} 251` : '60 251';
  
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen bg-slate-900' : ''}`}>
      <div className={`relative ${config.container}`}>
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#334155"
            strokeWidth={config.stroke}
          />
          {/* Progress/animated circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#22d3ee"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            className={showProgress ? 'transition-all duration-300' : 'animate-spin origin-center'}
            style={!showProgress ? { 
              animation: 'spin 1.5s linear infinite',
              transformOrigin: '50% 50%'
            } : {}}
          />
        </svg>
        {/* Percentage in center (only if progress is provided) */}
        {showProgress && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-cyan-400 font-bold ${config.text}`}>
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>
      {message && (
        <div className="text-cyan-400 font-medium text-center">
          {message}
        </div>
      )}
    </div>
  );

  return spinner;
};

export default LoadingSpinner;

