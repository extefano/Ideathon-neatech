---
name: muunar-ui-campo
description: 'Criterios de diseño, ajuste y revisión de la UI de Muunar para trabajo de campo. Usala SIEMPRE que crees o edites cualquier pantalla, componente, formulario, tabla, aviso o estado visible (app/, components/), cuando agregues o cambies estilos Tailwind, tokens de diseño, animaciones Motion, textos visibles al usuario, jerarquía visual o accesibilidad, y antes de dar por terminada cualquier tarea del épico de UI (#24).'
---

# UI de campo Muunar

Cómo se diseña, ajusta y revisa la interfaz de Muunar para que Productor,
Veterinario acreditado y Comprador entiendan cada pantalla sin capacitación.

## Cuándo usarla

- Toda creación o edición de UI en `app/` o `components/`.
- Cambios de estilos, tokens, tipografía, superficies, foco o animaciones.
- Redacción o revisión de textos que ve el usuario.
- Antes de cerrar cualquier issue del épico de UI.

## Criterio rector

Cada pantalla deja claro **qué está pasando** y **qué hacer después**. Lo
técnico va en un bloque "Detalles técnicos" plegable, nunca en el nivel
principal.

## Procedimiento

1. **Identificar la tarea y el rol**: ¿qué pantalla, para qué rol, en qué paso
   del flujo (alta → Sello 1 → escrow → Sello 2 → Sello 3)? Ver `GLOSSARY.md`.
2. **Revisar la pantalla y sus estados**: normal, vacío, cargando, error,
   sin permiso de rol, éxito. Ninguno puede quedar implícito.
3. **Simplificar**: reemplazar jerga por lenguaje llano, ordenar por jerarquía
   (resumen → acciones → detalles técnicos), quitarte todo lo que no cambie una
   decisión del usuario.
4. **Implementar con componentes compartidos**: tokens de `app/globals.css` y
   `components/ui/*` antes de escribir clases sueltas. Ver
   `references/criterios-ui.md`.
5. **Animar con mesura**: presets de `lib/motion.ts`, respetando
   `prefers-reduced-motion`. Ver `references/motion-tailwind.md`.
6. **Verificar el recorrido completo**: teclado, zoom 200 %, contraste,
   movimiento reducido y el flujo de los 3 roles.

## Reglas duras

- **Lenguaje directo, sin jerga**: nada de `umd_tree_cover_loss`, `escrow`,
  nombres de columnas ni códigos crudos en el nivel principal. Términos
  canónicos solo como apoyo o en "Detalles técnicos".
- **Formularios**: etiqueta permanente por campo (nunca solo placeholder),
  ayudas visibles y **error junto al campo** que lo produjo, anunciado de forma
  accesible (no solo color) vía `aria-invalid` + `aria-describedby`.
- **Controles de al menos 44 px** de alto útil y **foco de teclado visible** en
  todo elemento interactivo (nunca `outline: none` sin reemplazo).
- **Tildes y mayúsculas correctas** en todo texto visible (es-AR, voseo del
  repo).
- **Marca**: fondo oscuro; amarillo `#FDDA24` (`bg-brand`) **solo con texto
  negro** (`text-neutral-950`); rojo reservado a rechazo/error; nunca
  emerald/sky/indigo/violet/amber.
- **Sin clases ad-hoc nuevas** cuando ya existe token o componente compartido.
- **Estados accesibles**: `aria-current="step"` en el paso actual, `role="alert"`
  en errores, `role="status"` en avisos de éxito/info.

## Referencias

- `references/criterios-ui.md` — claridad, lenguaje, formularios, tablas,
  errores, foco y teclado.
- `references/motion-tailwind.md` — presets de Motion, duraciones y tokens
  Tailwind.
- `references/fuentes.md` — de dónde salen estas reglas.
