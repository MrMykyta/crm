import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';   // 👈 перед App
import './styles/rgl-overrides.css';
import './styles/theme.css';
import './styles/base.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <App />
);