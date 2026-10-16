# Integración Freighter y Fondeo de Cuentas en Stellar Testnet

Este documento describe cómo configurar, fondear (XLM + trustline USDC) y operar con **Freighter** (Desktop y Mobile vía WalletConnect v2) en las 4 pantallas transaccionales de Muunar sobre **Stellar Testnet**.

---

## 1. Aclaración de arquitectura (Transparencia del MVP)

El **escrow programable (40/30/30) sigue en modo demo** hasta el despliegue final del contrato Soroban en red. En la implementación actual:

- **Identidad real**: Las 4 pantallas (Registro de lote, Fondeo del escrow, Auditoría veterinaria del Mes 4 y Recepción en frigorífico) exigen conectar una wallet real (**Freighter**) en **Stellar Testnet** (`G...`, 56 caracteres). No se admiten wallets de texto ni defaults `GDEMO-*` en la interfaz.
- **Pagos reales USDC en Testnet**: Cada hito firmado desde la UI construye un XDR de transacción clásica `Operation.payment` en USDC Testnet mediante `@stellar/stellar-sdk` (`lib/stellar/payments.ts`), lo firma en Freighter (`signTransaction(xdr, { network: 'TESTNET', address })` o `stellar_signXDR` vía WalletConnect v2) y lo envía a **Horizon Testnet** (`https://horizon-testnet.stellar.org`).
- **Trazabilidad auditable**: El `tx_hash` real devuelto por la red se registra en `movimientos_escrow` y en los campos `soroban_*_tx_hash` del lote, con enlace directo a **Stellar Expert Testnet**.

---

## 2. Variables de entorno (`.env.example` / `.env.local`)

```bash
# RPC de Soroban, Horizon y passphrase de red (públicas para Freighter / navegador)
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Emisor clásico y Token USDC SAC en testnet
USDC_ISSUER_TESTNET=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
NEXT_PUBLIC_USDC_ISSUER_TESTNET=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
NEXT_PUBLIC_STELLAR_USDC_SAC=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

# WalletConnect v2 Project ID (para Freighter Mobile)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

---

## 3. Fondeo de cuentas de prueba (Friendbot + Trustline USDC)

Para operar los 3 roles en Stellar Testnet (Productor, Comprador/Frigorífico y Veterinario) se recomiendan al menos **2 o 3 cuentas separadas en Freighter** (dado que la regla anti auto-compra bloquea que el comprador use la misma dirección `G...` que el productor).

### Paso 3.1 — Crear cuentas y cambiar a Testnet en Freighter

1. Instalá la extensión [Freighter en Chrome Web Store](https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk) o la app móvil **Freighter Mobile**.
2. En el selector de red superior de Freighter, seleccioná **Testnet** (`Test SDF Network ; September 2015`).
   - _Gating de red_: Si Freighter está en `PUBLIC` (Mainnet) u otra red, el componente `ConnectWallet` muestra una alerta y bloquea la firma.

### Paso 3.2 — Fondear XLM en Testnet con Friendbot

Cada cuenta nueva (`G...`) necesita saldo nativo en XLM para existir en el ledger y pagar fees:

- **Desde Freighter**: Hacé clic en el botón **"Fund with Friendbot"** dentro de la extensión cuando estés en Testnet.
- **Vía HTTP / CLI**:
  ```bash
  curl "https://friendbot.stellar.org/?addr=TU_DIRECCION_G_AQUI"
  ```
- **Desde Stellar Laboratory**: Ingresá la clave pública en [https://laboratory.stellar.org/#account-creator?network=test](https://laboratory.stellar.org/#account-creator?network=test).

### Paso 3.3 — Abrir la Trustline de USDC Testnet

El activo USDC estándar de prueba en Stellar Testnet es:

- **Asset Code**: `USDC`
- **Issuer**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

Tanto la cuenta que **envía** como la cuenta que **recibe** (ej. el Productor) deben tener abierta la trustline a este emisor:

1. **Desde la propia dApp (Fondeo — Paso 2)**:
   - Al conectar tu wallet en `/lotes/[codigo]`, la app consulta Horizon Testnet (`verificarEstadoCuentaUsdc`).
   - Si tu cuenta aún no tiene la trustline activa, aparece el botón **"➕ Habilitar Trustline USDC"**, que construye una operación `Operation.changeTrust({ asset: USDC })` y te pide firmarla en Freighter (`crearTrustlineUsdcConFreighter`).
2. **Manualmente desde Freighter**:
   - En Freighter → _Manage Assets_ → _Add an asset_ → ingresar `USDC` y el issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.

### Paso 3.4 — Obtener USDC de prueba (Faucet integrado / DEX Testnet)

1. **Desde la dApp**: En la pantalla de Fondeo (`/lotes/[codigo]`), una vez activa la trustline de USDC, hacé clic en **"💧 Recibir USDC de prueba"**. El backend ejecuta `solicitarUsdcDemoAction` (`transferirUsdcDemo`), que transfiere USDC desde la cuenta admin o intercambia XLM por USDC mediante `Operation.pathPaymentStrictReceive` contra el DEX de Testnet.
2. **Para montos ágiles en Testnet**: Dado que la liquidez del DEX en Testnet es acotada, para pruebas E2E en vivo se recomienda crear lotes con montos de prueba de **10 a 50 USDC**.

---

## 4. Flujo en las 4 pantallas con Freighter

| Pantalla                 | Ruta                        | Rol           | Acción con Freighter                                                                                                                                                                                               |
| ------------------------ | --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Registro de lote**  | `/lotes/nuevo`              | `PRODUCTOR`   | Conecta Freighter (`productor_wallet`) en Testnet. Sin wallet conectada en Testnet, el envío queda bloqueado.                                                                                                      |
| **2. Fondeo del escrow** | `/lotes/[codigo]`           | `COMPRADOR`   | Conecta Freighter (`buyer_wallet`), valida que sea distinta a `productor_wallet` (anti auto-compra), firma el pago clásico USDC en Testnet y registra `DEPOSIT_ESCROW` + `RELEASE_MILESTONE_1` con `tx_hash` real. |
| **3. Auditoría Mes 4**   | `/lotes/[codigo]/auditoria` | `VETERINARIO` | Conecta Freighter (`vet_wallet`), firma la transacción en Testnet al aprobar el acta SIGSA y el pesaje RFID, y registra `RELEASE_MILESTONE_2` con `tx_hash` real.                                                  |
| **4. Recepción final**   | `/lotes/[codigo]/recepcion` | `COMPRADOR`   | Conecta Freighter (`buyer_wallet`), valida anti auto-compra, firma el pago de liquidación final USDC en Testnet y registra `RELEASE_MILESTONE_3` (y `REFUND_WEIGHT_SHORTFALL` si corresponde) con `tx_hash` real.  |

---

## 5. Fase B — Freighter Mobile (WalletConnect v2) y limitación conocida

El componente compartido `components/connect-wallet.tsx` y el módulo `lib/stellar/walletconnect.ts` permiten conectar **Freighter Mobile** mediante una sesión **WalletConnect v2** sobre la cadena `stellar:testnet` (mostrando el código QR para escanear desde el teléfono o el deep-link `freighter://wc?uri=...`).

### Limitación conocida del ecosistema

El módulo WalletConnect de _Stellar Wallets Kit_ actualmente **solo expone los métodos RPC `stellar_signXDR` y `stellar_signAndSubmitXDR`** (no expone `stellar_signMessage` ni `stellar_signAuthEntry`; ver issue upstream [`stellar/freighter-mobile#815`](https://github.com/stellar/freighter-mobile/issues/815)).

Por este motivo:

1. Muunar integra `@walletconnect/universal-provider` invocando `stellar_signXDR` sobre la red `stellar:testnet`.
2. Tanto la extensión de escritorio (`@stellar/freighter-api`) como Freighter Mobile (WalletConnect v2) firman el mismo XDR generado por `lib/stellar/payments.ts` y delegan el submit a Horizon Testnet desde la dApp.
