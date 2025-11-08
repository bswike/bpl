import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// In your src/main.js (or src/main.jsx)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Or wherever your main App component is
import { Analytics } from '@vercel/analytics/react'; // <-- 1. Import
import './index.css'; // Your global styles

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Analytics /> {/* <-- 2. Add the component here */}
  </React.StrictMode>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)