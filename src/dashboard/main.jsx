import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './dashboard.css';
import Dashboard from './Dashboard.jsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Dashboard root element #root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
