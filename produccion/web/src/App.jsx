import React from 'react';
import { AuthGate } from './auth/AuthGate.jsx';

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Gestión de Cobros Transporte</h1>
      <AuthGate />
    </div>
  );
}
