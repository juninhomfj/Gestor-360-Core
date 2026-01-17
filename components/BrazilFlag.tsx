
import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AudioService } from '../services/audioService';

interface BrazilFlagProps {
    className?: string;
    showSoundToggle?: boolean;
}

const BrazilFlag: React.FC<BrazilFlagProps> = ({ className = '', showSoundToggle = true }) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);

  const handleBrazilClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsSpinning(true);
      
      const duration = 3000;
      const end = Date.now() + duration;

      if (soundEnabled) {
          AudioService.play('SUCCESS');
      }

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#009c3b', '#ffdf00', '#002776']
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#009c3b', '#ffdf00', '#002776']
        });
  
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        } else {
            setIsSpinning(false);
        }
      };
      frame();
  };

  return (
    <div className={`flex items-center gap-2 relative group select-none ${className}`}>
        {showSoundToggle && (
            <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 transition-colors opacity-0 group-hover:opacity-100"
                title={soundEnabled ? "Som Ativado" : "Som Mudo"}
            >
                {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            </button>
        )}

        <div 
            className={`w-10 h-7 cursor-pointer transform transition-all duration-700 hover:scale-125 ${isSpinning ? 'animate-[spin_1s_ease-in-out_infinite]' : 'hover:rotate-6'}`}
            onClick={handleBrazilClick}
            title="Orgulhosamente Brasileiro (Clique!)"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 504" className="w-full h-full drop-shadow-sm rounded-[2px]">
                <rect width="720" height="504" fill="#009c3b" />
                <path d="M72,252 L360,36 L648,252 L360,468 Z" fill="#ffdf00" />
                <circle cx="360" cy="252" r="126" fill="#002776" />
                <path d="M246,285 C280,260 380,240 474,252 C480,265 460,285 360,290 C280,295 250,290 246,285" fill="#fff" />
            </svg>
        </div>
    </div>
  );
};

export default BrazilFlag;
