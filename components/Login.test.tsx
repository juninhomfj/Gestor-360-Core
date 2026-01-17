// components/Login.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Login from './Login';
import { User } from '../types';

// Mock dependencies
vi.mock('../services/auth', () => ({
  login: vi.fn(),
}));

vi.mock('./icons/ShieldCheckIcon', () => ({
  default: () => <div data-testid="shield-check-icon" />,
}));

vi.mock('./Logo', () => ({
  default: () => <div data-testid="logo-icon" />,
}));

vi.mock('./BrazilFlag', () => ({
    // Ensure it's a default export that's a valid React component
    __esModule: true, // This is important for modules with default exports
    default: (props: any) => <div data-testid="brazil-flag-icon" {...props} />,
  }));
  

// Import the mocked login function after mocking the module
import { login } from '../services/auth';

const mockOnLoginSuccess = vi.fn();
const mockOnRequestReset = vi.fn();
const mockUser: User = {
  id: '123',
  email: 'test@example.com',
  // Add other necessary user properties as defined in your User type
  // For example:
  name: 'Test User',
  profile: {
    avatar_url: '',
    full_name: 'Test User',
    username: 'testuser',
    website: '',
    level: 1,
    current_xp: 0,
    xp_needed_for_next_level: 100
  },
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

describe('Login Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should render all form elements correctly', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} onRequestReset={mockOnRequestReset} />);

    expect(screen.getByLabelText(/e-mail corporativo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('nome@empresa.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/senha de acesso/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acessar plataforma/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recuperar/i })).toBeInTheDocument();
  });

  it('should show an error if form is submitted with empty fields', async () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} onRequestReset={mockOnRequestReset} />);
    
    const submitButton = screen.getByRole('button', { name: /acessar plataforma/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText('Por favor, informe suas credenciais de acesso.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('should handle successful login', async () => {
    (login as vi.Mock).mockResolvedValue({ user: mockUser, error: null });

    render(<Login onLoginSuccess={mockOnLoginSuccess} onRequestReset={mockOnRequestReset} />);

    fireEvent.change(screen.getByPlaceholderText('nome@empresa.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /acessar plataforma/i });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Assuming the spinner has a role of status or similar

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('test@example.com', 'password123');
    });
    
    await waitFor(() => {
        expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockUser);
    });
  });

  it('should handle authentication failure', async () => {
    const errorMessage = 'Falha na autenticação. Verifique seus dados.';
    (login as vi.Mock).mockResolvedValue({ user: null, error: errorMessage });

    render(<Login onLoginSuccess={mockOnLoginSuccess} onRequestReset={mockOnRequestReset} />);

    fireEvent.change(screen.getByPlaceholderText('nome@empresa.com'), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /acessar plataforma/i }));

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /acessar plataforma/i })).not.toBeDisabled();
  });

  it('should handle exceptions during login', async () => {
    (login as vi.Mock).mockRejectedValue(new Error('Network Error'));

    render(<Login onLoginSuccess={mockOnLoginSuccess} onRequestReset={mockOnRequestReset} />);

    fireEvent.change(screen.getByPlaceholderText('nome@empresa.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /acessar plataforma/i }));

    expect(await screen.findByText('Ocorreu um erro ao conectar com a plataforma cloud.')).toBeInTheDocument();
    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /acessar plataforma/i })).not.toBeDisabled();
  });

  it('should call onRequestReset when the recover button is clicked', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} onRequestReset={mockOnRequestReset} />);

    const resetButton = screen.getByRole('button', { name: /recuperar/i });
    fireEvent.click(resetButton);

    expect(mockOnRequestReset).toHaveBeenCalledTimes(1);
  });
});
