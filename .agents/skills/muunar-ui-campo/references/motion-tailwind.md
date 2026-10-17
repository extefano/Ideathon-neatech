# Motion y Tailwind

## Instalación y base

- Dependencia `motion`; se importa `motion/react`.
- `components/motion-provider.tsx` envuelve la app en
  `<MotionConfig reducedMotion="user">` (montado en `app/layout.tsx`).
- Solo los componentes cliente pequeños importan `motion`; los Server
  Components quedan intactos.

## Presets (`lib/motion.ts`)

Reutilizá los presets, no inventes duraciones por pantalla.

| Preset            | Uso                          | Duración | Easing/spring |
| ----------------- | ---------------------------- | -------- | ------------- |
| `transicionEtapa` | cambio de etapa del alta     | 200 ms   | easeOut       |
| `aperturaDetalle` | abrir/cerrar "Detalles técnicos" | 200 ms | easeInOut   |
| `aparicionAviso`  | entrada de avisos/alertas    | 180 ms   | easeOut       |
| `carga`           | esqueleto/indicador de carga | 150 ms   | easeInOut     |

- Duraciones de **150–250 ms**. Nada de bounces largos ni loops infinitos de
  desplazamiento.
- Los springs se reservan a lo que aportan: apertura de detalles y cambio de
  etapa.

## Tailwind CSS 4

- Los tokens viven en `app/globals.css` dentro de `@theme`:
  tipografía (16/14 px), superficies (panel, borde), radios, foco y estados
  (`ok`/`alerta`/`error`).
- Usá `components/ui/*` (botón, campo, tarjeta, aviso, pasos, tabla) en vez de
  repetir `rounded-lg border border-neutral-800 bg-neutral-950/60 …`.
- Paleta: fondo claro cálido —usá los tokens de superficie (`superficie`,
  `panel`, `panel-elevado`, `borde`, `borde-fuerte`) y de texto (`texto`,
  `texto-suave`, `texto-tenue`); `bg-brand` (`#FDDA24`) **siempre** con
  `text-neutral-950` y `text-brand-fuerte` para texto/acento sobre claro; rojo
  solo para rechazo/error; nunca emerald/sky/indigo/violet/amber.
- `prettier-plugin-tailwindcss` ordena las clases: no pelees por el orden
  manual.
