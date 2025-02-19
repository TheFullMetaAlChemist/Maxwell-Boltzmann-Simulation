import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Ensure the linear scale (and others) are registered.
ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- Custom Plugin for Activation Energy Shading ---
const activationPlugin = {
  id: 'activationPlugin',
  afterDatasetsDraw(chart, args, options) {
    if (!options.showActivation) return;
    const { ctx, scales: { x, y } } = chart;
    const dynamicDataset = chart.data.datasets[0];
    if (!dynamicDataset) return;
    // Filter dynamic data points with x >= activationX.
    const regionPoints = dynamicDataset.data.filter(pt => pt.x >= options.activationX);
    if (regionPoints.length === 0) return;
    ctx.save();
    // Build polygon: start at (activationX, y=0)
    const xActivation = x.getPixelForValue(options.activationX);
    const yZero = y.getPixelForValue(0);
    ctx.beginPath();
    ctx.moveTo(xActivation, yZero);
    regionPoints.forEach(pt => {
      ctx.lineTo(x.getPixelForValue(pt.x), y.getPixelForValue(pt.y));
    });
    // Close polygon: from last point to (xMax, y=0) then back to (activationX, y=0)
    const xMax = x.getPixelForValue(options.xMax);
    ctx.lineTo(xMax, yZero);
    ctx.lineTo(xActivation, yZero);
    ctx.closePath();
    ctx.fillStyle = options.activationBackgroundColor || 'rgba(255,165,0,0.3)';
    ctx.fill();
    // Draw vertical dashed line at activationX.
    ctx.beginPath();
    ctx.setLineDash(options.activationLineDash || [4, 4]);
    ctx.moveTo(xActivation, y.getPixelForValue(0));
    ctx.lineTo(xActivation, y.getPixelForValue(options.yMax || 0.5));
    ctx.strokeStyle = options.activationLineColor || 'orange';
    ctx.lineWidth = options.activationLineWidth || 2;
    ctx.stroke();
    ctx.restore();
  }
};

ChartJS.register(activationPlugin);

const MBDistributionChart = ({ temperature, snapshots }) => {
  const chartRef = useRef(null);

  // Toggle states.
  const [showMostProbable, setShowMostProbable] = useState(false);
  const [showAverage, setShowAverage] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [showCatalyst, setShowCatalyst] = useState(false);

  // New state for recorded data.
  const [recordedData, setRecordedData] = useState([]);

  // Create fixed energy array from 0 to 600.
  // To adjust the energy range, change the value of N below.
  const energies = useMemo(() => {
    const N = 600;
    return Array.from({ length: N + 1 }, (_, i) => i);
  }, []);

  // Total number of molecules.
  const totalParticles = 50;

  // Effective temperature: T_eff = 0.5*T + 50.
  const effectiveTemperature = useCallback((T) => 0.5 * T + 50, []);

  // Sharpness parameter.
  const sharpness = 2;

  // Modified Maxwell–Boltzmann distribution function.
  // f(E,T) = (2/√π)*(1/T_eff)^(3/2)*√E*exp(-E/T_eff)*totalParticles
  // Using a multiplier of 0.72 for scaling.
  const mbDistribution = useCallback(
    (E, T) => {
      const T_eff = effectiveTemperature(T);
      if (T_eff <= 0) return 0;
      const norm = (2 / Math.sqrt(Math.PI)) * Math.pow(sharpness / T_eff, 1.5);
      return 0.72 * norm * Math.sqrt(E) * Math.exp(-E / T_eff) * totalParticles;
    },
    [effectiveTemperature, sharpness, totalParticles]
  );

  // Map temperature to a color.
  const getColorForTemperature = useCallback((T) => {
    const ratio = (T - 100) / (500 - 100);
    const red = Math.round(ratio * 255);
    const blue = Math.round((1 - ratio) * 255);
    return `rgb(${red},0,${blue})`;
  }, []);

  // Build the dynamic (current) dataset.
  const initialDynamicDataset = {
    label: `T = ${temperature} K`,
    data: energies.map((E) => ({ x: E, y: mbDistribution(E, temperature) })),
    borderColor: 'black',
    borderDash: [5, 5],
    fill: false,
    tension: 0.1,
    borderWidth: 1,
    pointRadius: 1,
    order: 2,
  };

  // Initialize chart data with the dynamic dataset.
  const [chartData, setChartDataState] = useState({
    datasets: [initialDynamicDataset],
  });

  // Effect 1: Update dynamic dataset on temperature change.
  useEffect(() => {
    if (chartRef.current) {
      const dynamicData = energies.map((E) => ({
        x: E,
        y: mbDistribution(E, temperature),
      }));
      chartRef.current.data.datasets[0].data = dynamicData;
      chartRef.current.data.datasets[0].label = `T = ${temperature} K`;
      chartRef.current.update();
    }
  }, [temperature, energies, mbDistribution]);

  // Effect 2: Update snapshot datasets when snapshots change.
  useEffect(() => {
    if (chartRef.current) {
      const snapshotDatasets = snapshots.map((snapT) => ({
        label: `T = ${snapT} K`,
        data: energies.map((E) => ({ x: E, y: mbDistribution(E, snapT) })),
        borderColor: getColorForTemperature(snapT),
        fill: false,
        tension: 0.1,
        borderWidth: 1,
        pointRadius: 1,
        order: 4,
      }));
      const dynamicDataset = chartRef.current.data.datasets[0];
      const markerDatasets = chartRef.current.data.datasets.filter(ds => ds.order === 5);
      chartRef.current.data.datasets = [dynamicDataset, ...snapshotDatasets, ...markerDatasets];
      chartRef.current.update();
    }
  }, [snapshots, energies, mbDistribution, getColorForTemperature]);

  // Effect 3: Update marker datasets for Most Probable and Average energies.
  useEffect(() => {
    if (chartRef.current) {
      const dynamicData = energies.map((E) => ({
        x: E,
        y: mbDistribution(E, temperature),
      }));
      let maxY = -Infinity;
      let E_mode = energies[0];
      dynamicData.forEach((pt) => {
        if (pt.y > maxY) {
          maxY = pt.y;
          E_mode = pt.x;
        }
      });
      const markers = [];
      if (showMostProbable) {
        markers.push({
          label: 'Most Probable Energy',
          data: [{ x: E_mode, y: maxY }],
          borderColor: 'blue',
          backgroundColor: 'blue',
          showLine: false,
          pointRadius: 5,
          isMarker: true,
          parsing: false,
          order: 5,
        });
      }
      if (showAverage) {
        let sumE = 0;
        let sumF = 0;
        dynamicData.forEach((pt) => {
          sumE += pt.x * pt.y;
          sumF += pt.y;
        });
        const E_mean = sumF ? sumE / sumF : 0;
        markers.push({
          label: 'Average Energy',
          data: [{ x: E_mean, y: mbDistribution(E_mean, temperature) }],
          borderColor: 'red',
          backgroundColor: 'red',
          showLine: false,
          pointRadius: 5,
          isMarker: true,
          parsing: false,
          order: 5,
        });
      }
      const nonMarker = chartRef.current.data.datasets.filter(ds => ds.order !== 5);
      chartRef.current.data.datasets = [...nonMarker, ...markers];
      chartRef.current.update();
    }
  }, [showMostProbable, showAverage, temperature, energies, mbDistribution]);

  // Effect 4: Activation Energy indicator and shading via the plugin.
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.options.plugins.activationPlugin = {
        showActivation: showActivation,
        activationLineColor: 'orange',
        activationLineDash: [4, 4],
        activationLineWidth: 2,
        activationBackgroundColor: 'rgba(255,165,0,0.3)',
        yMax: 0.5,
        // When catalyst is off, activation energy is 400; when on, 300.
        activationX: showCatalyst ? 300 : 400,
        xMax: 600,
      };
      chartRef.current.update();
    }
  }, [showActivation, showCatalyst, temperature, energies, mbDistribution]);

  // New Function: Handle recording data.
  const handleRecordData = () => {
    const dynamicData = energies.map((E) => ({
      x: E,
      y: mbDistribution(E, temperature),
    }));
    let maxY = -Infinity;
    let E_mode = energies[0];
    dynamicData.forEach((pt) => {
      if (pt.y > maxY) {
        maxY = pt.y;
        E_mode = pt.x;
      }
    });
    const totalArea = dynamicData.reduce((sum, pt) => sum + pt.y, 0);
    const threshold = showCatalyst ? 300 : 400;
    const regionArea = dynamicData
      .filter(pt => pt.x >= threshold)
      .reduce((sum, pt) => sum + pt.y, 0);
    const percentageAbove = totalArea ? (regionArea / totalArea) * 100 : 0;
    // For simplicity, we'll define rate of reaction equal to the percentageAbove.
    const newRecord = {
      temperature,
      mostProbableEnergy: E_mode,
      percentageAbove: percentageAbove.toFixed(2),
      rateOfReaction: percentageAbove.toFixed(2)
    };
    setRecordedData(prev => [...prev, newRecord]);
  };

  // Chart Options.
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        min: 0,
        max: 600, // x-axis now goes up to 600.
        title: { display: true, text: 'Energy' },
      },
      y: {
        min: 0,
        max: 0.5,
        title: { display: true, text: 'Number of molecules' },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: { usePointStyle: true, pointStyle: 'line', padding: 10 },
      },
      activationPlugin: {
        showActivation: showActivation,
        activationLineColor: 'orange',
        activationLineDash: [4, 4],
        activationLineWidth: 2,
        activationBackgroundColor: 'rgba(255,165,0,0.3)',
        yMax: 0.5,
        activationX: showCatalyst ? 300 : 400,
        xMax: 600,
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', height: '450px' }}>
        <Line ref={chartRef} data={chartData} options={options} />
        {/* Toggle buttons arranged in a vertical column in the top right under the temperature key */}
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <button
            onClick={() => setShowMostProbable(prev => !prev)}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #007BFF',
              backgroundColor: showMostProbable ? '#007BFF' : '#fff',
              color: showMostProbable ? '#fff' : '#007BFF',
              cursor: 'pointer',
            }}
          >
            Most Probable Energy
          </button>
          <button
            onClick={() => setShowAverage(prev => !prev)}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #DC3545',
              backgroundColor: showAverage ? '#DC3545' : '#fff',
              color: showAverage ? '#fff' : '#DC3545',
              cursor: 'pointer',
            }}
          >
            Average Energy
          </button>
          <button
            onClick={() => setShowActivation(prev => !prev)}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #28a745',
              backgroundColor: showActivation ? '#28a745' : '#fff',
              color: showActivation ? '#fff' : '#28a745',
              cursor: 'pointer',
            }}
          >
            Activation Energy
          </button>
          <button
            onClick={() => setShowCatalyst(prev => !prev)}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #8A2BE2',
              backgroundColor: showCatalyst ? '#8A2BE2' : '#fff',
              color: showCatalyst ? '#fff' : '#8A2BE2',
              cursor: 'pointer',
            }}
          >
            Catalyst
          </button>
          <button
            onClick={handleRecordData}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #6c757d',
              backgroundColor: '#fff',
              color: '#6c757d',
              cursor: 'pointer',
            }}
          >
            Record Data
          </button>
        </div>
      </div>
      {/* Table container below the graph */}
      <div style={{ marginTop: '20px', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Temperature (K)</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Most Probable Energy</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Percentage Above Activation</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Rate of Reaction</th>
            </tr>
          </thead>
          <tbody>
            {recordedData.map((row, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.temperature}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.mostProbableEnergy}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.percentageAbove}%</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.rateOfReaction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MBDistributionChart;