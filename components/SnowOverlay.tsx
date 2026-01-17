import React, { useEffect, useRef } from 'react';

const SnowOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    
    // Configuração das partículas de neve
    const particles: { x: number; y: number; radius: number; speed: number; opacity: number; sway: number }[] = [];
    const maxParticles = 60; // Quantidade otimizada para performance

    const createParticle = (initialY?: number) => ({
      x: Math.random() * w,
      y: initialY !== undefined ? initialY : Math.random() * h,
      radius: Math.random() * 2 + 1,
      speed: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      sway: Math.random() * 0.02
    });

    for (let i = 0; i < maxParticles; i++) {
      particles.push(createParticle());
    }

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';

      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.globalAlpha = p.opacity;
        ctx.fill();

        // Atualiza posição (queda e balanço lateral)
        p.y += p.speed;
        p.x += Math.sin(p.y * p.sway) * 0.5;

        // Resetar partícula se sair da tela
        if (p.y > h) {
          Object.assign(p, createParticle(-10));
        }
        if (p.x > w) p.x = 0;
        if (p.x < 0) p.x = w;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default SnowOverlay;