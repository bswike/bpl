import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // This is your FPLMultiGameweekDashboard
import { Analytics } from '@vercel/analytics/react';
import './index.css';

// This is the one and only render call you need.
// It includes StrictMode, your App, and Analytics.
ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);