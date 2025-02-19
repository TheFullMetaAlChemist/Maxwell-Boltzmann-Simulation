import React, { useState } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import MBDistributionChart from './components/MBDistributionChart';
import './App.css';

function App() {
  const [temperature, setTemperature] = useState(300);
  const [snapshots, setSnapshots] = useState([]);

  const handleTemperatureChange = (e) => {
    setTemperature(parseFloat(e.target.value));
  };

  const handleSnapshot = () => {
    setSnapshots([...snapshots, temperature]);
  };

  return (
    <div
      className="App"
      style={{
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#eef2f7',
        minHeight: '100vh',
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        Maxwell–Boltzmann Distribution Simulation
      </h2>
      <div
        className="control-container"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Temperature controls */}
        <div
          className="top-controls"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '20px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            backgroundColor: '#fff',
          }}
        >
          <label style={{ fontSize: '16px' }}>
            Temperature: {temperature} K
            <input
              type="range"
              min="100"
              max="500"
              step="1"
              value={temperature}
              onChange={handleTemperatureChange}
              style={{ marginLeft: '10px' }}
            />
          </label>
          <button
            onClick={handleSnapshot}
            style={{
              padding: '8px 16px',
              fontSize: '16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#007BFF',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Snapshot
          </button>
        </div>

        {/* Simulation and Graph side by side */}
        <div
          className="simulation-and-graph"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            justifyContent: 'center',
          }}
        >
          <div
            className="simulation-container"
            style={{
              flex: '1 1 400px',
              maxWidth: '400px',
            }}
          >
            <SimulationCanvas temperature={temperature} />
          </div>
          <div
            className="graph-container"
            style={{
              flex: '1 1 600px',
              maxWidth: '600px',
            }}
          >
            <MBDistributionChart temperature={temperature} snapshots={snapshots} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;