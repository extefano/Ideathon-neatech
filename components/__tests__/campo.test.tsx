// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Campo } from '@/components/ui/campo';

describe('Campo', () => {
  it('asocia la etiqueta permanente al control', () => {
    render(<Campo etiqueta="Correo electrónico" name="email" />);
    const input = screen.getByLabelText('Correo electrónico');
    expect(input).toHaveAttribute('id', 'campo-email');
    expect(input).toHaveAttribute('name', 'email');
  });

  it('marca la obligatoriedad y el aria-required', () => {
    render(<Campo etiqueta="Contraseña" name="password" requerido />);
    const input = screen.getByLabelText('Contraseña *');
    expect(input).toBeRequired();
  });

  it('anuncia el error junto al campo con aria-invalid y aria-describedby', () => {
    render(<Campo etiqueta="CUIT" name="cuit" error="El CUIT debe tener 11 dígitos" />);
    const input = screen.getByLabelText('CUIT');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'campo-cuit-error');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('El CUIT debe tener 11 dígitos');
    expect(input.className).toContain('border-red-600/50');
  });

  it('describe la ayuda cuando no hay error', () => {
    render(<Campo etiqueta="RENSPA" name="renspa" ayuda="Formato XX.XXX.X.XXXXX/XX" />);
    const input = screen.getByLabelText('RENSPA');
    expect(input).toHaveAttribute('aria-describedby', 'campo-renspa-ayuda');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Formato XX.XXX.X.XXXXX/XX')).toBeInTheDocument();
  });

  it('garantiza un área táctil de al menos 44 px', () => {
    render(<Campo etiqueta="Localidad" name="localidad" />);
    expect(screen.getByLabelText('Localidad').className).toContain('min-h-11');
  });
});
