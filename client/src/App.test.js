import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

// Create a stable mock socket that persists across tests
const mockSocket = {
  on: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  close: jest.fn(),
  id: 'test-socket-id',
};

// Mock socket.io-client - jest.mock is hoisted but can reference
// variables prefixed with 'mock' that are also hoisted
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import App from './App';

describe('App component - Welcome Screen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    // Reset mock implementations but keep return values
    mockSocket.on.mockClear().mockReturnThis();
    mockSocket.emit.mockClear();
    mockSocket.close.mockClear();
    // Reset io mock to always return mockSocket
    require('socket.io-client').io.mockClear();
    require('socket.io-client').io.mockReturnValue(mockSocket);
  });

  test('renders BINGO title', () => {
    render(<App />);
    expect(screen.getByText(/BINGO/)).toBeInTheDocument();
  });

  test('renders name input with placeholder', () => {
    render(<App />);
    const nameInput = screen.getByPlaceholderText(/Gib deinen Namen ein/);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('type', 'text');
  });

  test('renders "Spiel erstellen" button', () => {
    render(<App />);
    expect(screen.getByText('Spiel erstellen')).toBeInTheDocument();
  });

  test('renders "Beitreten" button', () => {
    render(<App />);
    expect(screen.getByText('Beitreten')).toBeInTheDocument();
  });

  test('renders grid size buttons (3x3 and 4x4)', () => {
    render(<App />);
    expect(screen.getByText('3x3')).toBeInTheDocument();
    expect(screen.getByText('4x4')).toBeInTheDocument();
  });

  test('renders game duration input', () => {
    render(<App />);
    const durationInput = screen.getByDisplayValue('60');
    expect(durationInput).toBeInTheDocument();
    expect(durationInput).toHaveAttribute('type', 'number');
  });
});
