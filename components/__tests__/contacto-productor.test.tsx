// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContactoProductor } from '@/components/contacto-productor';

describe('ContactoProductor', () => {
  it('ofrece contacto por correo y por WhatsApp como simulados (próximamente)', () => {
    render(<ContactoProductor />);
    expect(
      screen.getByRole('button', {
        name: 'Contactar al productor por correo electrónico (próximamente)',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Contactar al productor por WhatsApp (próximamente)',
      }),
    ).toBeDisabled();
  });

  it('son solo logo: sin texto visible y con el ícono oculto a lectores', () => {
    render(<ContactoProductor />);
    for (const boton of screen.getAllByRole('button')) {
      expect(boton).toHaveTextContent('');
      expect(boton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('respeta el área táctil de al menos 44 px', () => {
    render(<ContactoProductor />);
    for (const boton of screen.getAllByRole('button')) {
      expect(boton.className).toContain('min-h-11');
    }
  });
});
