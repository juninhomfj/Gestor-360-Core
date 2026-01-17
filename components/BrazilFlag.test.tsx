import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BrazilFlag from './BrazilFlag';
import { AudioService } from '../services/audioService';
import confetti from 'canvas-confetti';

// Mock AudioService
jest.mock('../services/audioService', () => ({
  AudioService: {
    play: jest.fn(),
  },
}));

// Mock canvas-confetti
jest.mock('canvas-confetti', () => jest.fn());

describe('BrazilFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Brazil flag SVG', () => {
    render(<BrazilFlag />);
    expect(screen.getByTitle('Orgulhosamente Brasileiro (Clique!)')).toBeInTheDocument();
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // SVG element
  });

  test('plays success sound and triggers confetti on click when sound is enabled', async () => {
    render(<BrazilFlag showSoundToggle={true} />);
    const flagDiv = screen.getByTitle('Orgulhosamente Brasileiro (Clique!)');
    
    fireEvent.click(flagDiv);

    expect(AudioService.play).toHaveBeenCalledWith('SUCCESS');
    expect(confetti).toHaveBeenCalled();

    // Ensure spinning class is applied and then removed
    expect(flagDiv).toHaveClass('animate-[spin_1s_ease-in-out_infinite]');
    await waitFor(() => {
        expect(flagDiv).not.toHaveClass('animate-[spin_1s_ease-in-out_infinite]');
    }, { timeout: 2100 }); // Animation duration is 2000ms
  });

  test('does not play sound when sound is disabled', async () => {
    render(<BrazilFlag showSoundToggle={true} />);
    const soundToggleButton = screen.getByTitle('Som Ativado'); // Initial state
    fireEvent.click(soundToggleButton); // Disable sound
    expect(screen.getByTitle('Som Mudo')).toBeInTheDocument();

    const flagDiv = screen.getByTitle('Orgulhosamente Brasileiro (Clique!)');
    fireEvent.click(flagDiv);

    expect(AudioService.play).not.toHaveBeenCalled();
    expect(confetti).toHaveBeenCalled(); // Confetti should still fire
  });

  test('does not show sound toggle when showSoundToggle is false', () => {
    render(<BrazilFlag showSoundToggle={false} />);
    expect(screen.queryByTitle('Som Ativado')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Som Mudo')).not.toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<BrazilFlag className="custom-test-class" />);
    const container = screen.getByTitle('Orgulhosamente Brasileiro (Clique!)').closest('div');
    expect(container).toHaveClass('custom-test-class');
  });
});
