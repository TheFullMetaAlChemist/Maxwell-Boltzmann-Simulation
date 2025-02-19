import React, { useRef, useEffect } from 'react';

const SimulationCanvas = ({ temperature }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const tempRef = useRef(temperature);

  // Update temperature ref when temperature changes.
  useEffect(() => {
    tempRef.current = temperature;
  }, [temperature]);

  const width = 400;
  const height = 400;
  const numParticles = 50;
  const baseSpeedFactor = 0.5; // desired average speed factor
  const restitution = 0.9; // coefficient of restitution for inelastic collisions

  // Initialize particles only once.
  // Each particle has its own position and velocity.
  const particlesRef = useRef([]);
  useEffect(() => {
    if (particlesRef.current.length === 0) {
      const particles = [];
      for (let i = 0; i < numParticles; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const angle = Math.random() * 2 * Math.PI;
        const speed = baseSpeedFactor * Math.sqrt(tempRef.current);
        const vx = speed * Math.cos(angle);
        const vy = speed * Math.sin(angle);
        const radius = 5;
        particles.push({ x, y, vx, vy, radius });
      }
      particlesRef.current = particles;
    }
  }, [width, height, numParticles]);

  // Inelastic collision handler for two particles.
  const handleCollision = (p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const dvx = p2.vx - p1.vx;
    const dvy = p2.vy - p1.vy;
    const relVel = dvx * nx + dvy * ny;
    if (relVel > 0) return; // already separating
    const impulse = -(1 + restitution) * relVel / 2;
    p1.vx -= impulse * nx;
    p1.vy -= impulse * ny;
    p2.vx += impulse * nx;
    p2.vy += impulse * ny;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const updateParticles = () => {
      // Clear and set background.
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#ccc';
      ctx.strokeRect(0, 0, width, height);

      const currentTemp = tempRef.current;
      const desiredAvgSpeed = baseSpeedFactor * Math.sqrt(currentTemp);
      const particles = particlesRef.current;

      // Update positions.
      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
      }

      // Wall collisions.
      for (let p of particles) {
        if (p.x - p.radius < 0) {
          p.x = p.radius;
          p.vx = Math.abs(p.vx);
        } else if (p.x + p.radius > width) {
          p.x = width - p.radius;
          p.vx = -Math.abs(p.vx);
        }
        if (p.y - p.radius < 0) {
          p.y = p.radius;
          p.vy = Math.abs(p.vy);
        } else if (p.y + p.radius > height) {
          p.y = height - p.radius;
          p.vy = -Math.abs(p.vy);
        }
      }

      // Particle collisions.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < p1.radius + p2.radius) {
            handleCollision(p1, p2);
            const overlap = p1.radius + p2.radius - dist;
            const sepX = (dx / dist) * (overlap / 2);
            const sepY = (dy / dist) * (overlap / 2);
            p1.x -= sepX;
            p1.y -= sepY;
            p2.x += sepX;
            p2.y += sepY;
          }
        }
      }

      // Thermostat: rescale velocities to maintain desired average speed.
      let sumSpeed = 0;
      for (let p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        sumSpeed += speed;
      }
      const avgSpeed = sumSpeed / particles.length;
      const scale = desiredAvgSpeed / (avgSpeed || 1);
      for (let p of particles) {
        p.vx *= scale;
        p.vy *= scale;
      }

      // Draw particles with a radial gradient and subtle shadow.
      for (let p of particles) {
        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          p.radius * 0.2,
          p.x,
          p.y,
          p.radius
        );
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(100,150,250,0.8)');
        gradient.addColorStop(1, 'rgba(50,100,200,0.5)');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(updateParticles);
    };

    animationRef.current = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animationRef.current);
  }, [width, height, baseSpeedFactor, restitution]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        backgroundColor: '#fff',
      }}
    />
  );
};

export default SimulationCanvas;