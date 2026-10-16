# Criterios de UI de campo

## Claridad

- Una idea principal por pantalla: el usuario sabe en 5 segundos dónde está y
  qué sigue.
- Jerarquía fija: **resumen → acción siguiente → evidencia/detalle técnico**.
- Un solo botón primario (amarillo) por vista; el resto son secundarios.
- Nunca dos acciones destructivas o de dinero compitiendo al mismo nivel.

## Lenguaje

- Español rioplatense, voseo, sin jerga técnica. Ejemplos:
  - "umd_tree_cover_loss ≥ 2021" → "Pérdida de bosque detectada después de 2020".
  - "escrow" → "depósito en garantía" (el término técnico, si aparece, va entre
    paréntesis o en Detalles técnicos).
  - "40/30/30" → "40 % al inicio, 30 % a mitad del engorde, 30 % en la entrega".
- Los estados del lote se muestran en lenguaje claro y se apoyan en el término
  canónico (ver `GLOSSARY.md` y `components/estado-badge.tsx`).
- Toda fecha se formatea en horario local: `new Date(x).toLocaleString('es-AR')`.
- Montos con `toLocaleString('es-AR')` y la moneda explícita.
- Inmutabilidad: explicar en una línea que el hash SHA-256 anclado en Stellar
  garantiza que el dato no fue alterado.

## Formularios

- Etiqueta **permanente** siempre visible; el placeholder es ayuda, no etiqueta.
- Campo obligatorio marcado y, si aplica, `required`/`aria-required`.
- Ayuda bajo el campo; **error bajo ese mismo campo**, nunca en un bloque
  general si es de un solo campo. Errores del formulario completo pueden ir
  arriba con `role="alert"`.
- `aria-invalid` en el campo con error y `aria-describedby` apuntando al texto
  de error/ayuda.
- Botón de envío con estado `loading`/`disabled` para evitar doble envío.
- Al avanzar por etapas, conservar valores y archivos al volver atrás.

## Avisos y errores

- `components/ui/aviso.tsx`: `info`, `exito`, `alerta`, `error`.
- `role="alert"` para error/alerta; `role="status"` para info/éxito.
- El rojo es la única excepción de la paleta y se reserva a rechazo/error
  (ej. `RECHAZADO_EUDR`).
- Errores accionables: qué pasó y qué hacer; sin códigos crudos.

## Tablas

- Encabezados con `<th scope="col">` y contraste suficiente.
- Alineación numérica a la derecha (kilos, montos); texto a la izquierda.
- Estado vacío explícito ("Todavía no hay movimientos").
- Legibles a 200 % de zoom; scroll horizontal contenido sin romper el layout.
- Filas no son controles; si algo es clicable, exponerlo con foco y semántica.

## Foco y teclado

- Todo interactivo alcanzable con Tab y activable con Enter/Espacio.
- `focus-visible` visible (anillo amarillo `ring-brand`) con contraste AA.
- Orden de tabulación = orden visual.
- Controles de al menos 44 px de alto útil (dedos en tablet/campo).
- Nunca `outline: none` sin un reemplazo visible.

## Movimiento accesible

- Duraciones 150–250 ms; nada de desplazamientos largos ni bucles.
- Con `prefers-reduced-motion: reduce` no hay animación de desplazamiento
  (lo garantiza `MotionConfig reducedMotion="user"` en `components/motion-provider.tsx`).

## Tokens

Definidos en `app/globals.css` (`@theme`). Preferí siempre el token o el
componente compartido antes que una clase suelta nueva.
