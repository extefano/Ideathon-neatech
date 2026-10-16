// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aviso } from '@/components/ui/aviso';
import { Pasos } from '@/components/ui/pasos';
import { Tabla } from '@/components/ui/tabla';
import { Tarjeta } from '@/components/ui/tarjeta';

describe('Tarjeta', () => {
  it('muestra el título y el contenido', () => {
    render(
      <Tarjeta titulo="Evidencia satelital" descripcion="Sin pérdida de bosque">
        <p>Contenido</p>
      </Tarjeta>,
    );
    expect(screen.getByRole('heading', { name: 'Evidencia satelital' })).toBeInTheDocument();
    expect(screen.getByText('Sin pérdida de bosque')).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });
});

describe('Aviso', () => {
  it('los avisos de error y alerta usan role="alert"', () => {
    render(
      <Aviso variante="error" titulo="No conforme EUDR">
        Pérdida arbórea detectada
      </Aviso>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No conforme EUDR');
  });

  it('los avisos de info y éxito usan role="status"', () => {
    render(<Aviso variante="exito" titulo="Sello 1 registrado" />);
    expect(screen.getByRole('status')).toHaveTextContent('Sello 1 registrado');
  });

  it('no sale de la paleta en el aviso de error (rojo reservado)', () => {
    render(<Aviso variante="error">Error</Aviso>);
    expect(screen.getByRole('alert').className).toContain('red-');
  });
});

describe('Pasos', () => {
  const pasos = [
    { titulo: 'Origen' },
    { titulo: 'Ganado' },
    { titulo: 'Documentos' },
    { titulo: 'Condiciones' },
  ];

  it('anuncia la etapa actual con aria-current="step"', () => {
    render(<Pasos pasos={pasos} actual={1} />);
    const actual = screen.getByText('Ganado').closest('li');
    expect(actual).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Origen').closest('li')).not.toHaveAttribute('aria-current');
  });
});

describe('Tabla', () => {
  const columnas = [
    { clave: 'rfid', titulo: 'Caravana' },
    { clave: 'peso', titulo: 'Peso (kg)', numerica: true },
  ];

  it('usa encabezados con scope="col" y alinea los números a la derecha', () => {
    render(<Tabla columnas={columnas} filas={[{ rfid: '032…', peso: '320' }]} />);
    const encabezados = screen.getAllByRole('columnheader');
    expect(encabezados).toHaveLength(2);
    for (const th of encabezados) {
      expect(th).toHaveAttribute('scope', 'col');
    }
    expect(encabezados[1].className).toContain('text-right');
  });

  it('muestra un estado vacío explícito', () => {
    render(<Tabla columnas={columnas} filas={[]} vacio="Todavía no hay movimientos" />);
    expect(screen.getByText('Todavía no hay movimientos')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
