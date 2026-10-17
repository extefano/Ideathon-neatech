// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormularioLote } from '@/app/lotes/nuevo/formulario';
import type { PerfilUsuario } from '@/lib/auth';
import type { ReporteHumedalV1 } from '@/lib/humedales';

const mocks = vi.hoisted(() => ({
  guardarPoligono: vi.fn(),
  crearLote: vi.fn(),
}));

vi.mock('@/app/lotes/nuevo/humedal-action', () => ({
  guardarPoligonoAction: mocks.guardarPoligono,
}));
vi.mock('@/app/lotes/nuevo/mapa-dibujo', () => ({
  default: () => <div data-testid="mapa-mock" />,
}));
vi.mock('@/lib/actions', () => ({ crearLoteAction: mocks.crearLote }));
vi.mock('@/components/connect-wallet', () => ({
  ConnectWallet: ({ name }: { name?: string }) => <input type="hidden" name={name} />,
}));

const USUARIO: PerfilUsuario = {
  id: 'u-1',
  rol: 'PRODUCTOR',
  nombre_completo: 'Estancia La Esperanza',
  cuit: '30-71234567-8',
  matricula: null,
  tipo_comprador: null,
  wallet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  productor_id: 'p-1',
  veterinario_id: null,
  comprador_id: null,
};

const POLIGONO_SIMPLE = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-58.1, -29.5],
      [-58.04, -29.5],
      [-58.04, -29.45],
      [-58.1, -29.45],
      [-58.1, -29.5],
    ],
  ],
});

const POLIGONO_CON_AGUJERO = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-58.1, -29.5],
      [-58.04, -29.5],
      [-58.04, -29.45],
      [-58.1, -29.45],
      [-58.1, -29.5],
    ],
    [
      [-58.08, -29.48],
      [-58.06, -29.48],
      [-58.06, -29.47],
      [-58.08, -29.48],
    ],
  ],
});

const POLIGONO_DEMO = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-58.15, -29.55],
      [-58.09, -29.55],
      [-58.09, -29.5],
      [-58.15, -29.5],
      [-58.15, -29.55],
    ],
  ],
});

const REPORTE: ReporteHumedalV1 = {
  esquema: 'muunar.humedal.v1',
  estado: 'VERIFICADO',
  motivo: null,
  poligono: JSON.parse(POLIGONO_SIMPLE) as ReporteHumedalV1['poligono'],
  superficieLoteHa: '10.0000',
  superficieHumedalHa: '5.0000',
  porcentajeHumedal: '50.0000',
  coberturaPct: '100',
  fuente: null,
  metodo: { version: '1', motor: 'postgis', sridEntrada: 4326, sridCalculo: 6933, modelo: 'x' },
  calculadoEn: '2026-10-17T05:00:00.000Z',
};

const RESULTADO_EXITO = {
  ok: true as const,
  verificacionId: 'ver-1',
  reporteHash: 'a'.repeat(64),
  reporte: REPORTE,
};

function textareaPoligono(): HTMLTextAreaElement {
  return screen.getByLabelText('GeoJSON del polígono') as HTMLTextAreaElement;
}

/** Completa origen y ganado y avanza hasta el paso 4 (condiciones y revisión). */
async function completarHastaRevision(
  despuesDePoligono?: () => void | Promise<void>,
): Promise<HTMLTextAreaElement> {
  const textarea = textareaPoligono();
  fireEvent.change(textarea, { target: { value: POLIGONO_SIMPLE } });
  if (despuesDePoligono) await despuesDePoligono();
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

  const csvInput = document.getElementById('archivo_rfid_csv') as HTMLInputElement;
  const file = new File(
    ['caravana_rfid,peso_kg\n032000000000001,200\n032000000000002,205\n'],
    'pesadas.csv',
    { type: 'text/csv' },
  );
  Object.defineProperty(csvInput, 'files', { value: [file], configurable: true });
  fireEvent.change(csvInput);
  await screen.findByText(/2 cabezas/);

  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

  return textarea;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.crearLote.mockResolvedValue({ errors: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gate de envío del alta (resultado ambiental revisado)', () => {
  it('sin análisis vigente el primer clic analiza y el envío recién ocurre en el segundo', async () => {
    mocks.guardarPoligono.mockResolvedValue(RESULTADO_EXITO);
    render(<FormularioLote user={USUARIO} />);
    await completarHastaRevision();

    fireEvent.click(screen.getByRole('button', { name: 'Analizar humedal y revisar' }));

    expect(await screen.findByText('Análisis ambiental listo')).toBeInTheDocument();
    expect(mocks.guardarPoligono).toHaveBeenCalledTimes(1);
    expect(mocks.guardarPoligono).toHaveBeenCalledWith(POLIGONO_SIMPLE);
    expect(mocks.crearLote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar lote y validar EUDR' }));

    await waitFor(() => expect(mocks.crearLote).toHaveBeenCalledTimes(1));
    const formData = mocks.crearLote.mock.calls[0]?.find(
      (argumento) => argumento instanceof FormData,
    ) as FormData;
    expect(formData.get('verificacion_humedal')).toBe('ver-1');
    expect(formData.get('poligono')).toBe(POLIGONO_SIMPLE);
    expect(formData.get('creacion_key')).toBeTruthy();
  });

  it('con un análisis ya vigente el primer clic envía, sin reanalizar', async () => {
    mocks.guardarPoligono.mockResolvedValue(RESULTADO_EXITO);
    render(<FormularioLote user={USUARIO} />);
    await completarHastaRevision(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Analizar humedal' }));
      await screen.findByText('50 % del campo');
    });

    expect(screen.getByRole('button', { name: 'Enviar lote y validar EUDR' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar lote y validar EUDR' }));

    await waitFor(() => expect(mocks.crearLote).toHaveBeenCalledTimes(1));
    expect(mocks.guardarPoligono).toHaveBeenCalledTimes(1);
    const formData = mocks.crearLote.mock.calls[0]?.find(
      (argumento) => argumento instanceof FormData,
    ) as FormData;
    expect(formData.get('verificacion_humedal')).toBe('ver-1');
    expect(formData.get('creacion_key')).toBeTruthy();
  });

  it('un análisis fallido bloquea el envío, muestra el error y exige reintentar', async () => {
    mocks.guardarPoligono.mockResolvedValue({
      ok: false,
      errores: ['El servicio de humedales no respondió.'],
    });
    render(<FormularioLote user={USUARIO} />);
    await completarHastaRevision();

    fireEvent.click(screen.getByRole('button', { name: 'Analizar humedal y revisar' }));

    const errores = await screen.findAllByText('El servicio de humedales no respondió.');
    expect(errores.length).toBeGreaterThan(0);
    expect(mocks.crearLote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Analizar humedal y revisar' }));
    await waitFor(() => expect(mocks.guardarPoligono).toHaveBeenCalledTimes(2));
    expect(mocks.crearLote).not.toHaveBeenCalled();
  });

  it('si cambia el polígono, la vigencia anterior no habilita el envío', async () => {
    mocks.guardarPoligono.mockResolvedValue(RESULTADO_EXITO);
    render(<FormularioLote user={USUARIO} />);
    const textarea = await completarHastaRevision();

    fireEvent.click(screen.getByRole('button', { name: 'Analizar humedal y revisar' }));
    await screen.findByText('Análisis ambiental listo');

    fireEvent.change(textarea, { target: { value: POLIGONO_CON_AGUJERO } });

    expect(screen.queryByText('Análisis ambiental listo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analizar humedal y revisar' }));
    await waitFor(() => expect(mocks.guardarPoligono).toHaveBeenCalledTimes(2));
    expect(mocks.guardarPoligono.mock.calls[1]?.[0]).toBe(POLIGONO_CON_AGUJERO);
    expect(mocks.crearLote).not.toHaveBeenCalled();
  });
});

describe('carrera de la carga demo del polígono', () => {
  it('una respuesta tardía del demo no pisa una edición posterior ni analiza', async () => {
    let entregarDemo!: (respuesta: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            entregarDemo = resolve;
          }),
      ),
    );

    render(<FormularioLote user={USUARIO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar polígono de demo' }));

    const textarea = textareaPoligono();
    fireEvent.change(textarea, { target: { value: POLIGONO_SIMPLE } });

    await act(async () => {
      entregarDemo(new Response(POLIGONO_DEMO, { status: 200 }));
      await Promise.resolve();
    });

    await waitFor(() => expect(textarea.value).toBe(POLIGONO_SIMPLE));
    expect(mocks.guardarPoligono).not.toHaveBeenCalled();
  });

  it('un error tardío del demo no muestra aviso si hubo edición posterior', async () => {
    let fallarDemo!: (error: Error) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            fallarDemo = reject;
          }),
      ),
    );

    render(<FormularioLote user={USUARIO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar polígono de demo' }));
    fireEvent.change(textareaPoligono(), { target: { value: POLIGONO_SIMPLE } });

    await act(async () => {
      fallarDemo(new Error('sin red'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/No se pudo cargar el polígono de demo/)).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos analizar el humedal')).not.toBeInTheDocument();
  });

  it('el error del demo se anuncia cuando no hubo edición y no toca el análisis', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    render(<FormularioLote user={USUARIO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar polígono de demo' }));

    expect(await screen.findByText(/No se pudo cargar el polígono de demo/)).toBeInTheDocument();
    expect(mocks.guardarPoligono).not.toHaveBeenCalled();
    expect(screen.queryByText('No pudimos analizar el humedal')).not.toBeInTheDocument();
  });
});

describe('polígonos con agujeros', () => {
  it('deshabilita el editor y explica por qué', () => {
    render(<FormularioLote user={USUARIO} />);
    fireEvent.change(textareaPoligono(), { target: { value: POLIGONO_CON_AGUJERO } });

    const botonDibujar = screen.getByRole('button', { name: 'Dibujar polígono' });

    expect(botonDibujar).toBeDisabled();
    expect(botonDibujar).toHaveAttribute('aria-describedby', 'poligono-agujeros');
    expect(screen.getByText(/El editor del mapa no los soporta/)).toBeInTheDocument();
  });

  it('un polígono simple permite dibujar y no muestra la explicación', () => {
    render(<FormularioLote user={USUARIO} />);
    fireEvent.change(textareaPoligono(), { target: { value: POLIGONO_SIMPLE } });

    expect(screen.getByRole('button', { name: 'Dibujar polígono' })).toBeEnabled();
    expect(screen.queryByText(/El editor del mapa no los soporta/)).not.toBeInTheDocument();
  });
});
