#![no_std]
//! Contrato de trazabilidad ganadera EUDR + escrow por hitos.
//!
//! Flujo (un `Lote` por `codigo_lote`):
//! 1. `create_and_verify_origin` — firma el oráculo/admin tras validar el polígono contra GFW (Sello 1).
//! 2. `fund_lot_escrow`          — firma el comprador: deposita el total y se libera el 40% al productor.
//! 3. `verify_sanitary_milestone`— firma el veterinario autorizado: valida ADPV y libera el 30% (Sello 2).
//! 4. `complete_delivery_and_settle` — firma el comprador/frigorífico: libera el 30% final con
//!    ajuste proporcional por faltante de peso (Sello 3).
//!
//! Los documentos completos viven fuera de la cadena; on-chain solo se anclan hashes SHA-256.
//!
//! El hash de origen (`eudr_geo_hash`, argumento de `create_and_verify_origin`) compromete el
//! manifiesto de origen v2 (`muunar.origen.v2`), que incluye el SHA-256 del reporte de humedales
//! del establecimiento. El contrato no interpreta ese JSON: solo conserva y devuelve el hash,
//! y la verificación de inclusión se hace fuera de la cadena con los bytes exactos.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String,
};

/// Rango biológico válido del ADPV (INTA Corrientes), en gramos/día.
pub const ADPV_MIN_G_DIA: u32 = 500;
pub const ADPV_MAX_G_DIA: u32 = 1300;

const TTL_THRESHOLD: u32 = 1_000_000;
const TTL_EXTEND_TO: u32 = 3_000_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    LoteYaExiste = 1,
    LoteInexistente = 2,
    EstadoInvalido = 3,
    MontoInvalido = 4,
    AutoCompraBloqueada = 5,
    VeterinarioNoAutorizado = 6,
    AdpvFueraDeRango = 7,
    CompradorNoCoincide = 8,
    PesoInvalido = 9,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Estado {
    /// Sello 1 emitido, esperando fondeo.
    OrigenVerificado,
    /// Fondeado; 40% liberado al productor.
    Financiado,
    /// Sello 2 emitido; 30% liberado.
    SanidadVerificada,
    /// Sello 3 emitido; ciclo cerrado.
    Cerrado,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Lote {
    pub producer: Address,
    pub buyer: Option<Address>,
    pub renspa_doc_hash: String,
    pub rfid_list_hash: String,
    pub eudr_geo_hash: String,
    pub head_count: u32,
    /// Pesos en gramos para evitar decimales on-chain.
    pub initial_avg_weight_g: u32,
    pub target_weight_g: u32,
    /// Monto total del escrow en la unidad mínima del token (7 decimales en USDC/SAC).
    pub financing_amount: i128,
    pub midterm_avg_weight_g: u32,
    pub adpv_g_per_day: u32,
    pub vaccination_acta_hash: String,
    pub midterm_weights_hash: String,
    pub dte_pdf_hash: String,
    pub reception_hash: String,
    pub final_avg_weight_g: u32,
    pub paid_to_producer: i128,
    pub refunded_to_buyer: i128,
    pub estado: Estado,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Vet(Address),
    Lote(String),
}

#[contractevent]
pub struct OrigenVerificado {
    #[topic]
    pub codigo: String,
    pub producer: Address,
    pub eudr_geo_hash: String,
}

#[contractevent]
pub struct EscrowFondeado {
    #[topic]
    pub codigo: String,
    pub buyer: Address,
    pub amount: i128,
    pub released_to_producer: i128,
}

#[contractevent]
pub struct SanidadVerificada {
    #[topic]
    pub codigo: String,
    pub vet: Address,
    pub adpv_g_per_day: u32,
    pub released_to_producer: i128,
}

#[contractevent]
pub struct EntregaLiquidada {
    #[topic]
    pub codigo: String,
    pub buyer: Address,
    pub paid_to_producer: i128,
    pub refunded_to_buyer: i128,
}

#[contract]
pub struct Trazabilidad;

#[contractimpl]
impl Trazabilidad {
    /// `admin` = oráculo del backend; `token` = contrato SAC del USDC (testnet/mainnet).
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Solo el admin: habilita a un veterinario acreditado (registro SENASA fuera de cadena).
    pub fn authorize_vet(env: Env, vet: Address) {
        Self::admin(&env).require_auth();
        let key = DataKey::Vet(vet);
        env.storage().persistent().set(&key, &true);
        Self::bump(&env, &key);
    }

    pub fn revoke_vet(env: Env, vet: Address) {
        Self::admin(&env).require_auth();
        env.storage().persistent().remove(&DataKey::Vet(vet));
    }

    pub fn is_vet(env: Env, vet: Address) -> bool {
        env.storage().persistent().has(&DataKey::Vet(vet))
    }

    /// Sello 1: lo firma el admin/oráculo después de validar el polígono contra GFW.
    #[allow(clippy::too_many_arguments)]
    pub fn create_and_verify_origin(
        env: Env,
        codigo: String,
        producer: Address,
        renspa_doc_hash: String,
        rfid_list_hash: String,
        eudr_geo_hash: String,
        head_count: u32,
        initial_avg_weight_g: u32,
        target_weight_g: u32,
        financing_amount: i128,
    ) -> Result<(), Error> {
        Self::admin(&env).require_auth();

        let key = DataKey::Lote(codigo.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::LoteYaExiste);
        }
        if financing_amount <= 0 {
            return Err(Error::MontoInvalido);
        }
        if target_weight_g == 0 || head_count == 0 {
            return Err(Error::PesoInvalido);
        }

        let empty = String::from_str(&env, "");
        let lote = Lote {
            producer: producer.clone(),
            buyer: None,
            renspa_doc_hash,
            rfid_list_hash,
            eudr_geo_hash: eudr_geo_hash.clone(),
            head_count,
            initial_avg_weight_g,
            target_weight_g,
            financing_amount,
            midterm_avg_weight_g: 0,
            adpv_g_per_day: 0,
            vaccination_acta_hash: empty.clone(),
            midterm_weights_hash: empty.clone(),
            dte_pdf_hash: empty.clone(),
            reception_hash: empty,
            final_avg_weight_g: 0,
            paid_to_producer: 0,
            refunded_to_buyer: 0,
            estado: Estado::OrigenVerificado,
        };
        Self::save(&env, &key, &lote);

        OrigenVerificado { codigo, producer, eudr_geo_hash }.publish(&env);
        Ok(())
    }

    /// Hito 1: el comprador deposita el total y se libera el 40% al productor.
    pub fn fund_lot_escrow(
        env: Env,
        codigo: String,
        buyer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        buyer.require_auth();

        let key = DataKey::Lote(codigo.clone());
        let mut lote = Self::load(&env, &key)?;
        if lote.estado != Estado::OrigenVerificado {
            return Err(Error::EstadoInvalido);
        }
        if buyer == lote.producer {
            return Err(Error::AutoCompraBloqueada);
        }
        if amount != lote.financing_amount {
            return Err(Error::MontoInvalido);
        }

        let token = Self::token(&env);
        let this = env.current_contract_address();
        token.transfer(&buyer, &this, &amount);

        let hito1 = Self::hito1(amount);
        token.transfer(&this, &lote.producer, &hito1);

        lote.buyer = Some(buyer.clone());
        lote.paid_to_producer = hito1;
        lote.estado = Estado::Financiado;
        Self::save(&env, &key, &lote);

        EscrowFondeado { codigo, buyer, amount, released_to_producer: hito1 }.publish(&env);
        Ok(())
    }

    /// Sello 2: lo firma un veterinario autorizado. Valida ADPV y libera el 30%.
    pub fn verify_sanitary_milestone(
        env: Env,
        codigo: String,
        vet: Address,
        midterm_avg_weight_g: u32,
        adpv_g_per_day: u32,
        vaccination_acta_hash: String,
        midterm_weights_hash: String,
    ) -> Result<(), Error> {
        vet.require_auth();
        if !env.storage().persistent().has(&DataKey::Vet(vet.clone())) {
            return Err(Error::VeterinarioNoAutorizado);
        }

        let key = DataKey::Lote(codigo.clone());
        let mut lote = Self::load(&env, &key)?;
        if lote.estado != Estado::Financiado {
            return Err(Error::EstadoInvalido);
        }
        if vet == lote.producer || Some(vet.clone()) == lote.buyer {
            return Err(Error::VeterinarioNoAutorizado);
        }
        if !(ADPV_MIN_G_DIA..=ADPV_MAX_G_DIA).contains(&adpv_g_per_day) {
            return Err(Error::AdpvFueraDeRango);
        }
        if midterm_avg_weight_g == 0 {
            return Err(Error::PesoInvalido);
        }

        let hito2 = Self::hito2(lote.financing_amount);
        token::Client::new(&env, &Self::token_addr(&env)).transfer(
            &env.current_contract_address(),
            &lote.producer,
            &hito2,
        );

        lote.midterm_avg_weight_g = midterm_avg_weight_g;
        lote.adpv_g_per_day = adpv_g_per_day;
        lote.vaccination_acta_hash = vaccination_acta_hash;
        lote.midterm_weights_hash = midterm_weights_hash;
        lote.paid_to_producer += hito2;
        lote.estado = Estado::SanidadVerificada;
        Self::save(&env, &key, &lote);

        SanidadVerificada { codigo, vet, adpv_g_per_day, released_to_producer: hito2 }
            .publish(&env);
        Ok(())
    }

    /// Sello 3: lo firma el comprador/frigorífico. Libera el 30% final con ajuste por faltante.
    /// Devuelve `(pago_al_productor, reembolso_al_comprador)`.
    pub fn complete_delivery_and_settle(
        env: Env,
        codigo: String,
        buyer: Address,
        final_avg_weight_g: u32,
        dte_pdf_hash: String,
        reception_hash: String,
    ) -> Result<(i128, i128), Error> {
        buyer.require_auth();

        let key = DataKey::Lote(codigo.clone());
        let mut lote = Self::load(&env, &key)?;
        if lote.estado != Estado::SanidadVerificada {
            return Err(Error::EstadoInvalido);
        }
        if lote.buyer != Some(buyer.clone()) {
            return Err(Error::CompradorNoCoincide);
        }
        if final_avg_weight_g == 0 {
            return Err(Error::PesoInvalido);
        }

        let hito3 = Self::hito3(lote.financing_amount);
        let deduccion = Self::deduccion(
            lote.financing_amount,
            hito3,
            lote.target_weight_g,
            final_avg_weight_g,
        );
        let pago = hito3 - deduccion;

        let token = Self::token(&env);
        let this = env.current_contract_address();
        if pago > 0 {
            token.transfer(&this, &lote.producer, &pago);
        }
        if deduccion > 0 {
            token.transfer(&this, &buyer, &deduccion);
        }

        lote.final_avg_weight_g = final_avg_weight_g;
        lote.dte_pdf_hash = dte_pdf_hash;
        lote.reception_hash = reception_hash;
        lote.paid_to_producer += pago;
        lote.refunded_to_buyer = deduccion;
        lote.estado = Estado::Cerrado;
        Self::save(&env, &key, &lote);

        EntregaLiquidada { codigo, buyer, paid_to_producer: pago, refunded_to_buyer: deduccion }
            .publish(&env);
        Ok((pago, deduccion))
    }

    pub fn get_lote(env: Env, codigo: String) -> Result<Lote, Error> {
        Self::load(&env, &DataKey::Lote(codigo))
    }

    pub fn admin_address(env: Env) -> Address {
        Self::admin(&env)
    }

    // ---- helpers ------------------------------------------------------------------------

    fn hito1(total: i128) -> i128 {
        total * 40 / 100
    }

    fn hito2(total: i128) -> i128 {
        total * 30 / 100
    }

    /// El tramo final absorbe el redondeo para que 40+30+30 sume exactamente el total.
    fn hito3(total: i128) -> i128 {
        total - Self::hito1(total) - Self::hito2(total)
    }

    /// Misma regla que `calcularLiquidacionFinal` del backend: proporcional al faltante,
    /// con tope en el tramo final.
    fn deduccion(total: i128, tramo_final: i128, objetivo_g: u32, final_g: u32) -> i128 {
        if final_g >= objetivo_g {
            return 0;
        }
        let faltante = (objetivo_g - final_g) as i128;
        let ded = total * faltante / (objetivo_g as i128);
        if ded > tramo_final {
            tramo_final
        } else {
            ded
        }
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn token_addr(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    fn token(env: &Env) -> token::Client<'_> {
        token::Client::new(env, &Self::token_addr(env))
    }

    fn load(env: &Env, key: &DataKey) -> Result<Lote, Error> {
        env.storage().persistent().get(key).ok_or(Error::LoteInexistente)
    }

    fn save(env: &Env, key: &DataKey, lote: &Lote) {
        env.storage().persistent().set(key, lote);
        Self::bump(env, key);
    }

    fn bump(env: &Env, key: &DataKey) {
        env.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

mod test;
