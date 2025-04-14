import React from 'react';
import ReactDOM from 'react-dom/client';
import FitnessLog from './FitnessLog';
import './index.css'; // 如果需要

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <FitnessLog />
  </React.StrictMode>
);
