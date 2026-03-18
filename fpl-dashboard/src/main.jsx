import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Calcutta from './components/Calcutta.jsx';
import { Analytics } from '@vercel/analytics/react';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/calcutta" element={<Calcutta />} />
      </Routes>
    </BrowserRouter>
    <Analytics />
  </StrictMode>
);
