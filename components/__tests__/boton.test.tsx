// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Boton } from '@/components/ui/boton';

describe('Boton', () => {
  it('renderiza el contenido y un botón de tipo button por defecto', () => {
    render(<Boton>Fondear escrow</Boton>);
    const boton = screen.getByRole('button', { name: 'Fondear escrow' });
    expect(boton).toHaveAttribute('type', 'button');
  });

  it('en variante primaria usa amarillo de marca con texto negro', () => {
    render(<Boton>Enviar</Boton>);
    const boton = screen.getByRole('button', { name: 'Enviar' });
    expect(boton.className).toContain('bg-brand');
    expect(boton.className).toContain('text-neutral-950');
  });

  it('en variante peligro reserva el rojo para acciones destructivas', () => {
    render(<Boton variante="peligro">Rechazar</Boton>);
    const boton = screen.getByRole('button', { name: 'Rechazar' });
    expect(boton.className).toContain('red-');
  });

  it('no permite doble envío cuando está cargando', () => {
    render(<Boton cargando>Firmando</Boton>);
    const boton = screen.getByRole('button', { name: 'Firmando' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
  });

  it('respeta el estado disabled explícito', () => {
    render(<Boton disabled>Deshabilitado</Boton>);
    expect(screen.getByRole('button', { name: 'Deshabilitado' })).toBeDisabled();
  });

  it('garantiza un área táctil de al menos 44 px', () => {
    render(<Boton>Área</Boton>);
    expect(screen.getByRole('button', { name: 'Área' }).className).toContain('min-h-11');
  });
});
