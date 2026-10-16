# Reporte de la noche — 16/10/2026

## TL;DR

- **MVP de los 5 pasos funcionando E2E** contra Supabase real y Global Forest Watch real.
- **10 tickets cerrados (#6–#15)** con evidencia; épicos #1–#5 completados.
- **CI/CD 100% verde** (lint, typecheck, 30 tests, build, format, audit, gitleaks, migraciones).
- **Producción: falta UN paso manual** — conectar el proyecto en Vercel (2 minutos, ver abajo).

## El flujo completo, verificado en vivo (no smoke test)

1. **Paso 1 — Registro + EUDR**: `LOTE-00106` creado desde el formulario (30 caravanas RFID `032…`,
   polígono cargado/dibujado, CSV validado con métricas: 199,8 kg prom, Parejo). GFW real:
   **0 ha de pérdida ≥ 2021** → Sello 1 + tx hash. `LOTE-00105` con otro polígono dio **10,56 ha
   reales de pérdida → RECHAZADO_EUDR** (el filtro rechaza de verdad, con reporte por año).
2. **Paso 2 — Escrow**: fondeo de 10.000 USDC → `DEPOSIT_ESCROW` + liberación automática del 40%
   (`RELEASE_MILESTONE_1` = 4.000 USDC) ✓.
3. **Paso 3 — Auditoría vet Mes 4**: 30 caravanas conciliadas contra el padrón, ADPV = 1,0 kg/día
   (200→320 kg en 120 días, dentro del rango INTA 0,5–1,3) → Sello 2 + 3.000 USDC (30%) → liberado 7.000.
4. **Paso 4 — DT-e + recepción**: despacho con DT-e → `EN_TRANSITO_A_FRIGORIFICO`; balanza fiscal
   459,8 kg prom → liquidación con **retención automática por kilos faltantes**: 2.995,65 USDC al
   productor + 4,35 devueltos al comprador → Sello 3, `CERRADO_CICLO`, **liberado total 9.995,65 USDC**.
5. **Paso 5 — Pasaporte QR**: `/pasaporte/LOTE-00106` público con 3/3 sellos, hashes SHA-256, links a
   Stellar Expert, QR descargable, GeoJSON para TRACES UE, verificador de integridad SHA-256 en el
   navegador y trazabilidad individual por caravana (+260 kg por animal).

## Datos de demo cargados

- `LOTE-00105` (rechazado EUDR), `LOTE-00106` (ciclo completo + pasaporte), `LOTE-00107` y `LOTE-00108`
  (DISPONIBLE en el marketplace), `LOTE-00109` (FINANCIADO_EN_ENGORDE).
- Archivos demo en `public/demo/`: CSVs (inicial, batch B, Mes 4, final), PDFs (RENSPA, acta SIGSA,
  DT-e, ticket) y polígono GeoJSON. Los formularios tienen botones "Usar … de demo".

## Calidad y verificación adversarial

- 30 tests unitarios (`lib/__tests__/`: csv, crypto, geo, gfw, escrow, stellar).
- Validación E2E en el navegador de Orca: 7 páginas cargan con **0 errores de consola**.
- **RLS verificado**: escritura con anon key → 401 bloqueada; lectura pública → 200.
- CI verde en cada push; Gitleaks verde; migraciones aplicadas al remoto (5 migraciones).

## Qué es REAL y qué es MODO DEMO (transparencia total)

| Integración                         | Estado                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| GFW (pérdida forestal EUDR)         | **REAL** — `data-api.globalforestwatch.org` con key en `.env.local`        |
| Supabase (DB, Storage, RLS, Auth)   | **REAL**                                                                   |
| Uploads + hashes SHA-256            | **REAL**                                                                   |
| Validación CSV RFID / ADPV / escrow | **REAL** (lógica con tests)                                                |
| QR + verificador de integridad      | **REAL** (server-side `qrcode` + Web Crypto)                               |
| Stellar / Soroban                   | **MODO DEMO** — tx hashes deterministas + links a Stellar Expert testnet; `lib/stellar` ya expone la interfaz del contrato |
| Freighter (wallets)                 | **DEMO** — wallets de texto (`GDEMO-*`)                                    |
| SENASA / SIGSA                      | Documental (subida + hash); no existe API pública integrada                |

## Para verlo funcionando

**Local (ya configurado):**

```
pnpm dev  →  http://localhost:3000
```

**Producción (único pendiente):**
1. Vercel → Add New → Import `Ideathon-neatech` → **copiar las variables de `.env.local`** a
   Environment Variables (Production + Preview) → Deploy. Cualquier push a `main` deploya solo.
2. Alternativa por workflow: cargar secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   (aviso: `deploy-vercel.yml` queda verde-con-aviso hasta que existan; después deploya solo).

## Decisiones autónomas tomadas (dudas de negocio del protocolo)

- Tracker: GitHub Issues + labels default de triage + docs de dominio single-context (`GLOSSARY.md`, `docs/adr/`).
- Escrituras a DB: server actions con secret key (bypassa RLS); lecturas públicas con anon.
- ADPV: en el formulario del vet, "días transcurridos" editable (demo = 120, Mes 4).
- Conciliación RFID estricta (sin tolerancias de merma) para el MVP.
- Rechazo EUDR: el lote queda visible en la ficha con el reporte por año (no se borra).

## Pendientes sugeridos (próxima sesión)

1. Conectar Vercel + env vars → producción con dominio.
2. Contrato Soroban real (Rust + `stellar-sdk`) detrás de la interfaz `lib/stellar` (hoy fake documentado).
3. Freighter real: conectar wallet y firmar transacciones.
4. Rotar la password de la DB (circuló en el chat) y actualizar `.env.local` + secret `SUPABASE_DB_URL`.
5. Playwright para E2E en CI y rate limiting en endpoints de escritura si se abre al público.
