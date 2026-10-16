#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Env, String,
};

const USDC: i128 = 10_000_000; // 1 USDC = 10^7 unidades (7 decimales)

struct Ctx<'a> {
    env: Env,
    client: TrazabilidadClient<'a>,
    token: TokenClient<'a>,
    producer: Address,
    buyer: Address,
    vet: Address,
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());

    let contract_id = env.register(Trazabilidad, (admin, sac.address()));
    let client = TrazabilidadClient::new(&env, &contract_id);

    let producer = Address::generate(&env);
    let buyer = Address::generate(&env);
    let vet = Address::generate(&env);
    StellarAssetClient::new(&env, &sac.address()).mint(&buyer, &(20_000 * USDC));

    Ctx { env, client, token, producer, buyer, vet }
}

fn s(env: &Env, v: &str) -> String {
    String::from_str(env, v)
}

fn crear(c: &Ctx, codigo: &str) {
    c.client.create_and_verify_origin(
        &s(&c.env, codigo),
        &c.producer,
        &s(&c.env, "renspa-hash"),
        &s(&c.env, "rfid-hash"),
        &s(&c.env, "geo-hash"),
        &30,
        &240_000,
        &460_000,
        &(10_000 * USDC),
    );
}

#[test]
fn flujo_completo_libera_40_30_30() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-1");
    crear(&c, "LOTE-1");
    c.client.authorize_vet(&c.vet);

    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));
    assert_eq!(c.token.balance(&c.producer), 4_000 * USDC);
    assert_eq!(c.token.balance(&c.client.address), 6_000 * USDC);

    c.client.verify_sanitary_milestone(
        &codigo,
        &c.vet,
        &320_000,
        &650,
        &s(&c.env, "acta"),
        &s(&c.env, "csv-mes4"),
    );
    assert_eq!(c.token.balance(&c.producer), 7_000 * USDC);

    let (pago, reembolso) = c.client.complete_delivery_and_settle(
        &codigo,
        &c.buyer,
        &460_000,
        &s(&c.env, "dte"),
        &s(&c.env, "recepcion"),
    );
    assert_eq!((pago, reembolso), (3_000 * USDC, 0));
    assert_eq!(c.token.balance(&c.producer), 10_000 * USDC);
    assert_eq!(c.token.balance(&c.client.address), 0);
    assert_eq!(c.client.get_lote(&codigo).estado, Estado::Cerrado);
}

#[test]
fn faltante_de_peso_reembolsa_proporcionalmente() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-2");
    crear(&c, "LOTE-2");
    c.client.authorize_vet(&c.vet);
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));
    c.client.verify_sanitary_milestone(
        &codigo,
        &c.vet,
        &320_000,
        &650,
        &s(&c.env, "a"),
        &s(&c.env, "b"),
    );

    // 414 kg sobre objetivo de 460 kg = 10% de faltante => 1.000 USDC de deducción.
    let (pago, reembolso) = c.client.complete_delivery_and_settle(
        &codigo,
        &c.buyer,
        &414_000,
        &s(&c.env, "dte"),
        &s(&c.env, "rec"),
    );
    assert_eq!(reembolso, 1_000 * USDC);
    assert_eq!(pago, 2_000 * USDC);
    assert_eq!(c.token.balance(&c.buyer), 11_000 * USDC);
}

#[test]
fn deduccion_tiene_tope_en_el_tramo_final() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-3");
    crear(&c, "LOTE-3");
    c.client.authorize_vet(&c.vet);
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));
    c.client.verify_sanitary_milestone(
        &codigo,
        &c.vet,
        &320_000,
        &650,
        &s(&c.env, "a"),
        &s(&c.env, "b"),
    );

    let (pago, reembolso) = c.client.complete_delivery_and_settle(
        &codigo,
        &c.buyer,
        &100_000,
        &s(&c.env, "dte"),
        &s(&c.env, "rec"),
    );
    assert_eq!((pago, reembolso), (0, 3_000 * USDC));
}

#[test]
fn bloquea_auto_compra() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-4");
    crear(&c, "LOTE-4");
    StellarAssetClient::new(&c.env, &c.token.address).mint(&c.producer, &(10_000 * USDC));
    let r = c.client.try_fund_lot_escrow(&codigo, &c.producer, &(10_000 * USDC));
    assert_eq!(r, Err(Ok(Error::AutoCompraBloqueada)));
}

#[test]
fn bloquea_doble_fondeo_y_monto_distinto() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-5");
    crear(&c, "LOTE-5");
    assert_eq!(
        c.client.try_fund_lot_escrow(&codigo, &c.buyer, &(9_000 * USDC)),
        Err(Ok(Error::MontoInvalido))
    );
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));
    assert_eq!(
        c.client.try_fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC)),
        Err(Ok(Error::EstadoInvalido))
    );
}

#[test]
fn rechaza_lote_duplicado() {
    let c = setup();
    crear(&c, "LOTE-6");
    let r = c.client.try_create_and_verify_origin(
        &s(&c.env, "LOTE-6"),
        &c.producer,
        &s(&c.env, "x"),
        &s(&c.env, "x"),
        &s(&c.env, "x"),
        &30,
        &240_000,
        &460_000,
        &(10_000 * USDC),
    );
    assert_eq!(r, Err(Ok(Error::LoteYaExiste)));
}

#[test]
fn solo_veterinario_autorizado_puede_sellar() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-7");
    crear(&c, "LOTE-7");
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));

    let r = c.client.try_verify_sanitary_milestone(
        &codigo,
        &c.vet,
        &320_000,
        &650,
        &s(&c.env, "a"),
        &s(&c.env, "b"),
    );
    assert_eq!(r, Err(Ok(Error::VeterinarioNoAutorizado)));
}

#[test]
fn el_productor_no_puede_ser_el_veterinario() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-8");
    crear(&c, "LOTE-8");
    c.client.authorize_vet(&c.producer);
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));

    let r = c.client.try_verify_sanitary_milestone(
        &codigo,
        &c.producer,
        &320_000,
        &650,
        &s(&c.env, "a"),
        &s(&c.env, "b"),
    );
    assert_eq!(r, Err(Ok(Error::VeterinarioNoAutorizado)));
}

#[test]
fn adpv_fuera_de_rango_frena_el_desembolso() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-9");
    crear(&c, "LOTE-9");
    c.client.authorize_vet(&c.vet);
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));

    for adpv in [499u32, 1301u32] {
        let r = c.client.try_verify_sanitary_milestone(
            &codigo,
            &c.vet,
            &320_000,
            &adpv,
            &s(&c.env, "a"),
            &s(&c.env, "b"),
        );
        assert_eq!(r, Err(Ok(Error::AdpvFueraDeRango)));
    }
    assert_eq!(c.token.balance(&c.producer), 4_000 * USDC);
}

#[test]
fn el_cierre_exige_al_comprador_que_fondeo() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-10");
    crear(&c, "LOTE-10");
    c.client.authorize_vet(&c.vet);
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));
    c.client.verify_sanitary_milestone(
        &codigo,
        &c.vet,
        &320_000,
        &650,
        &s(&c.env, "a"),
        &s(&c.env, "b"),
    );

    let otro = Address::generate(&c.env);
    let r = c.client.try_complete_delivery_and_settle(
        &codigo,
        &otro,
        &460_000,
        &s(&c.env, "dte"),
        &s(&c.env, "rec"),
    );
    assert_eq!(r, Err(Ok(Error::CompradorNoCoincide)));
}

#[test]
fn no_se_puede_cerrar_sin_sello_2() {
    let c = setup();
    let codigo = s(&c.env, "LOTE-11");
    crear(&c, "LOTE-11");
    c.client.fund_lot_escrow(&codigo, &c.buyer, &(10_000 * USDC));
    let r = c.client.try_complete_delivery_and_settle(
        &codigo,
        &c.buyer,
        &460_000,
        &s(&c.env, "dte"),
        &s(&c.env, "rec"),
    );
    assert_eq!(r, Err(Ok(Error::EstadoInvalido)));
}

#[test]
fn lote_inexistente() {
    let c = setup();
    assert_eq!(
        c.client.try_get_lote(&s(&c.env, "NOPE")),
        Err(Ok(Error::LoteInexistente))
    );
}
