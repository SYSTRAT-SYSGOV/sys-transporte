use axum::{
    extract::{Path, Query, State},
    http::header,
    response::{IntoResponse, Response},
    routing::{delete, get},
    Json, Router,
};
use chrono::{NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;

use crate::{
    audit::{record, AuditEvent},
    auth::{
        perms::{
            ALLOCATION_MANAGE, ALLOCATION_READ, CENSUS_EXPORT, CENSUS_READ, OVERRIDE_CAPACITY,
        },
        AuthUser,
    },
    domain::{
        contract_valid, driver_issues, inspection_valid, record60_declared, DriverEligibility,
    },
    error::{AppError, AppResult},
    state::{AppState, ReqCtx},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/routes/{id}/students",
            get(list_allocations).post(create_allocation),
        )
        .route(
            "/routes/{id}/students/{allocation_id}",
            delete(close_allocation),
        )
        .route("/census/validation", get(census_validation))
        .route("/census/export", get(census_export))
}

#[derive(Debug, Serialize, FromRow)]
pub struct AllocationDto {
    pub id: String,
    pub student_id: String,
    pub student_name: String,
    pub enrollment_id: String,
    pub route_id: String,
    pub route_name: String,
    pub stop_id: Option<String>,
    pub stop_name: Option<String>,
    pub shift: String,
    pub uses_rural_transport: bool,
    pub public_transport_jurisdiction: Option<i8>,
    pub special_needs_transport: bool,
    pub special_needs_notes: Option<String>,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub end_reason: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct AllocationPayload {
    pub student_id: String,
    pub stop_id: Option<String>,
    pub shift: Option<String>,
    #[serde(default)]
    pub uses_rural_transport: bool,
    pub public_transport_jurisdiction: Option<i8>,
    #[serde(default)]
    pub special_needs_transport: bool,
    pub special_needs_notes: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub override_justification: Option<String>,
}

pub async fn list_allocations(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(route_id): Path<String>,
    Query(query): Query<AllocationQuery>,
) -> AppResult<Json<Vec<AllocationDto>>> {
    auth.require(ALLOCATION_READ)?;
    let include_closed = query.include_closed.unwrap_or(false);
    let items = sqlx::query_as::<_, AllocationDto>(
        "SELECT a.id, a.student_id, st.full_name AS student_name, a.enrollment_id,
                a.route_id, r.name AS route_name, a.stop_id, s.name AS stop_name,
                a.shift, a.uses_rural_transport, a.public_transport_jurisdiction,
                a.special_needs_transport, a.special_needs_notes, a.start_date,
                a.end_date, a.end_reason, a.created_at
         FROM transport_allocations a
         JOIN students st ON st.id = a.student_id
         JOIN transport_routes r ON r.id = a.route_id
         LEFT JOIN transport_stops s ON s.id = a.stop_id
         WHERE a.route_id = ? AND (? = TRUE OR a.end_date IS NULL)
         ORDER BY st.full_name",
    )
    .bind(&route_id)
    .bind(include_closed)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(items))
}

#[derive(Debug, Deserialize)]
pub struct AllocationQuery {
    pub include_closed: Option<bool>,
}

pub async fn create_allocation(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(route_id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<AllocationPayload>,
) -> AppResult<Json<AllocationDto>> {
    auth.require(ALLOCATION_MANAGE)?;
    let today = Utc::now().date_naive();

    let mut tx = state.pool.begin().await?;

    let route: Option<(
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        bool,
    )> = sqlx::query_as(
        "SELECT academic_year_id, shift, vehicle_id, driver_id, company_id, is_active
         FROM transport_routes WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(&route_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((academic_year_id, route_shift, vehicle_id, driver_id, company_id, is_active)) = route
    else {
        return Err(AppError::not_found("Rota não encontrada"));
    };
    if !is_active {
        return Err(AppError::conflict("Rota inativa"));
    }
    if let Some(shift) = body.shift.as_deref() {
        if shift != route_shift {
            return Err(AppError::validation_single(
                "shift",
                "deve ser igual ao turno da rota",
            ));
        }
    }

    if let Some(company_id) = &company_id {
        let company: Option<(bool, Option<NaiveDate>)> = sqlx::query_as(
            "SELECT is_active, contract_end_date FROM transport_companies
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(company_id)
        .fetch_optional(&mut *tx)
        .await?;
        let Some((company_active, contract_end)) = company else {
            return Err(AppError::conflict("Empresa da rota não encontrada"));
        };
        if !company_active {
            return Err(AppError::conflict("Empresa de transporte inativa"));
        }
        if !contract_valid(contract_end, today) {
            return Err(AppError::conflict(
                "Contrato da empresa de transporte vencido",
            ));
        }
    }

    if let Some(driver_id) = &driver_id {
        let driver: Option<(
            bool,
            String,
            NaiveDate,
            NaiveDate,
            Option<NaiveDate>,
            Option<NaiveDate>,
        )> = sqlx::query_as(
            "SELECT is_active, cnh_category, cnh_expiration_date, birth_date,
                    course_expiration_date, toxicological_expiration_date
             FROM transport_drivers WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(driver_id)
        .fetch_optional(&mut *tx)
        .await?;
        let Some((driver_active, category, cnh_exp, birth, course_exp, tox_exp)) = driver else {
            return Err(AppError::conflict("Motorista da rota não encontrado"));
        };
        if !driver_active {
            return Err(AppError::conflict("Motorista da rota está inativo"));
        }
        let issues = driver_issues(&DriverEligibility {
            cnh_category: &category,
            cnh_expiration: cnh_exp,
            birth_date: birth,
            course_expiration: course_exp,
            toxicological_expiration: tox_exp,
            today,
        });
        if !issues.is_empty() {
            return Err(AppError::conflict(format!(
                "Motorista da rota inelegível: {}",
                issues.join("; ")
            )));
        }
    }

    let enrollment: Option<(String, String)> = sqlx::query_as(
        "SELECT id, shift FROM enrollments
         WHERE student_id = ? AND academic_year_id = ? AND status = 'active' AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(&body.student_id)
    .bind(&academic_year_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((enrollment_id, enrollment_shift)) = enrollment else {
        return Err(AppError::validation_single(
            "student_id",
            "estudante sem matrícula ativa no ano letivo da rota",
        ));
    };

    if let Some(stop_id) = &body.stop_id {
        let belongs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM transport_route_stops WHERE route_id = ? AND stop_id = ?",
        )
        .bind(&route_id)
        .bind(stop_id)
        .fetch_one(&mut *tx)
        .await?;
        if belongs == 0 {
            return Err(AppError::validation_single(
                "stop_id",
                "parada não pertence ao itinerário da rota",
            ));
        }
    }

    let vehicle: Option<(i32, bool, Option<NaiveDate>, bool)> =
        if let Some(vehicle_id) = &vehicle_id {
            sqlx::query_as(
            "SELECT passenger_capacity, is_accessible_disability, inspection_valid_until, is_active
             FROM transport_vehicles WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(vehicle_id)
        .fetch_optional(&mut *tx)
        .await?
        } else {
            None
        };
    let Some((capacity, is_accessible, inspection_until, vehicle_active)) = vehicle else {
        return Err(AppError::conflict("Rota sem veículo vinculado"));
    };
    if !vehicle_active {
        return Err(AppError::conflict("Veículo da rota está inativo"));
    }
    if !inspection_valid(inspection_until, today) {
        return Err(AppError::conflict(
            "Veículo com vistoria DETRAN vencida ou não registrada",
        ));
    }

    if body.special_needs_transport && !is_accessible {
        return Err(AppError::conflict(
            "Estudante com necessidade de transporte adaptado exige veículo acessível",
        ));
    }

    let allocated: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_allocations WHERE route_id = ? AND end_date IS NULL",
    )
    .bind(&route_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut overridden = false;
    if allocated >= capacity as i64 {
        let can_override = auth.can(OVERRIDE_CAPACITY);
        let justification = body
            .override_justification
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if !can_override || justification.is_none() {
            return Err(AppError::conflict(format!(
                "Capacidade do veículo atingida ({allocated}/{capacity}); informe justificativa de exceção com permissão adequada"
            )));
        }
        overridden = true;
    }

    let shift = body.shift.clone().unwrap_or_else(|| route_shift.clone());
    if !crate::domain::shift_valid(&shift) {
        return Err(AppError::validation_single("shift", "turno inválido"));
    }
    if let Some(jurisdiction) = body.public_transport_jurisdiction {
        if !(1..=3).contains(&jurisdiction) {
            return Err(AppError::validation_single(
                "public_transport_jurisdiction",
                "use 1 (estadual), 2 (municipal) ou 3 (compartilhado)",
            ));
        }
    }

    let id = uuid::Uuid::now_v7().to_string();
    let start_date = body.start_date.unwrap_or(today);
    sqlx::query(
        "INSERT INTO transport_allocations
         (id, student_id, enrollment_id, route_id, stop_id, shift, uses_rural_transport,
          public_transport_jurisdiction, special_needs_transport, special_needs_notes, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.student_id)
    .bind(&enrollment_id)
    .bind(&route_id)
    .bind(body.stop_id.as_deref())
    .bind(&shift)
    .bind(body.uses_rural_transport)
    .bind(body.public_transport_jurisdiction)
    .bind(body.special_needs_transport)
    .bind(body.special_needs_notes.as_deref())
    .bind(start_date)
    .execute(&mut *tx)
    .await?;

    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: if overridden {
                "create_with_capacity_override"
            } else {
                "create"
            },
            resource: "transport.allocation",
            resource_id: Some(&id),
            before: None,
            after: Some(&json!({
                "student_id": body.student_id,
                "route_id": route_id,
                "enrollment_shift": enrollment_shift,
                "capacity": capacity,
                "allocated": allocated,
                "override_justification": body.override_justification,
            })),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;

    load_allocation(&state, &id).await
}

#[derive(Debug, Deserialize)]
pub struct CloseAllocation {
    pub end_date: Option<NaiveDate>,
    pub reason: Option<String>,
}

pub async fn close_allocation(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((route_id, allocation_id)): Path<(String, String)>,
    ctx: ReqCtx,
    Json(body): Json<CloseAllocation>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(ALLOCATION_MANAGE)?;
    let today = Utc::now().date_naive();
    let end_date = body.end_date.unwrap_or(today);

    let mut tx = state.pool.begin().await?;
    let start_date: Option<NaiveDate> = sqlx::query_scalar(
        "SELECT start_date FROM transport_allocations
         WHERE id = ? AND route_id = ? AND end_date IS NULL",
    )
    .bind(&allocation_id)
    .bind(&route_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(start_date) = start_date else {
        return Err(AppError::not_found("Alocação ativa não encontrada"));
    };
    if end_date < start_date {
        return Err(AppError::validation_single(
            "end_date",
            "não pode ser anterior ao início da alocação",
        ));
    }

    sqlx::query("UPDATE transport_allocations SET end_date = ?, end_reason = ? WHERE id = ?")
        .bind(end_date)
        .bind(body.reason.as_deref().unwrap_or("Desvínculo solicitado"))
        .bind(&allocation_id)
        .execute(&mut *tx)
        .await?;

    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "close",
            resource: "transport.allocation",
            resource_id: Some(&allocation_id),
            before: None,
            after: Some(&json!({ "end_date": end_date, "reason": body.reason })),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;

    Ok(Json(json!({ "status": "ok" })))
}

async fn load_allocation(state: &AppState, id: &str) -> AppResult<Json<AllocationDto>> {
    let item = sqlx::query_as::<_, AllocationDto>(
        "SELECT a.id, a.student_id, st.full_name AS student_name, a.enrollment_id,
                a.route_id, r.name AS route_name, a.stop_id, s.name AS stop_name,
                a.shift, a.uses_rural_transport, a.public_transport_jurisdiction,
                a.special_needs_transport, a.special_needs_notes, a.start_date,
                a.end_date, a.end_reason, a.created_at
         FROM transport_allocations a
         JOIN students st ON st.id = a.student_id
         JOIN transport_routes r ON r.id = a.route_id
         LEFT JOIN transport_stops s ON s.id = a.stop_id
         WHERE a.id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Alocação não encontrada"))?;
    Ok(Json(item))
}

// ------------------------------- Censo -------------------------------

#[derive(Debug, Deserialize)]
pub struct CensusQuery {
    pub academic_year_id: String,
}

#[derive(Debug, Serialize)]
pub struct CensusPendency {
    pub enrollment_id: String,
    pub student_id: String,
    pub student_name: String,
    pub school_name: String,
    pub kind: String,
    pub detail: String,
}

#[derive(Debug, Serialize)]
pub struct CensusValidation {
    pub academic_year_id: String,
    pub year: i32,
    pub total_students: i64,
    pub approved: bool,
    pub pendencies: Vec<CensusPendency>,
}

#[derive(Debug, FromRow)]
struct CensusRow {
    enrollment_id: String,
    student_id: String,
    student_name: String,
    school_name: String,
    allocation_id: Option<String>,
    uses_rural_transport: Option<bool>,
    public_transport_jurisdiction: Option<i8>,
    special_needs_transport: Option<bool>,
    vehicle_id: Option<String>,
    is_accessible_disability: Option<bool>,
}

pub async fn census_validation(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<CensusQuery>,
) -> AppResult<Json<CensusValidation>> {
    auth.require(CENSUS_READ)?;
    let validation = build_census(&state, &query.academic_year_id).await?;
    Ok(Json(validation))
}

async fn build_census(state: &AppState, year_id: &str) -> AppResult<CensusValidation> {
    let year: Option<i32> = sqlx::query_scalar("SELECT year FROM academic_years WHERE id = ?")
        .bind(year_id)
        .fetch_optional(&state.pool)
        .await?;
    let year = year.ok_or_else(|| AppError::not_found("Ano letivo não encontrado"))?;

    let rows = sqlx::query_as::<_, CensusRow>(
        "SELECT e.id AS enrollment_id, st.id AS student_id, st.full_name AS student_name,
                sc.name AS school_name, a.id AS allocation_id, a.uses_rural_transport,
                a.public_transport_jurisdiction, a.special_needs_transport,
                r.vehicle_id, v.is_accessible_disability
         FROM enrollments e
         JOIN students st ON st.id = e.student_id
         JOIN schools sc ON sc.id = e.school_id
         LEFT JOIN transport_allocations a ON a.enrollment_id = e.id AND a.end_date IS NULL
         LEFT JOIN transport_routes r ON r.id = a.route_id
         LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
         WHERE e.academic_year_id = ? AND e.status = 'active' AND e.deleted_at IS NULL
           AND st.deleted_at IS NULL
         ORDER BY st.full_name",
    )
    .bind(year_id)
    .fetch_all(&state.pool)
    .await?;

    let mut pendencies = Vec::new();
    for row in &rows {
        if row.allocation_id.is_none() {
            pendencies.push(pendency(
                row,
                "sem_alocacao_ativa",
                "Estudante sem alocação ativa no transporte",
            ));
            continue;
        }
        if row.vehicle_id.is_none() {
            pendencies.push(pendency(
                row,
                "rota_sem_veiculo",
                "Rota vinculada sem veículo",
            ));
        }
        if row.uses_rural_transport == Some(true) && row.public_transport_jurisdiction.is_none() {
            pendencies.push(pendency(
                row,
                "rural_sem_declaracao",
                "Uso de transporte rural sem poder público responsável declarado",
            ));
        }
        if row.special_needs_transport == Some(true) && row.is_accessible_disability != Some(true) {
            pendencies.push(pendency(
                row,
                "veiculo_nao_adaptado",
                "Estudante com necessidade especial em veículo não adaptado",
            ));
        }
    }

    Ok(CensusValidation {
        academic_year_id: year_id.to_string(),
        year,
        total_students: rows.len() as i64,
        approved: pendencies.is_empty(),
        pendencies,
    })
}

fn pendency(row: &CensusRow, kind: &str, detail: &str) -> CensusPendency {
    CensusPendency {
        enrollment_id: row.enrollment_id.clone(),
        student_id: row.student_id.clone(),
        student_name: row.student_name.clone(),
        school_name: row.school_name.clone(),
        kind: kind.to_string(),
        detail: detail.to_string(),
    }
}

pub async fn census_export(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<CensusQuery>,
) -> AppResult<Response> {
    auth.require(CENSUS_EXPORT)?;
    let year: i32 = sqlx::query_scalar("SELECT year FROM academic_years WHERE id = ?")
        .bind(&query.academic_year_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Ano letivo não encontrado"))?;

    #[derive(FromRow)]
    struct ExportRow {
        student_id: String,
        student_name: String,
        school_name: String,
        shift: String,
        uses_rural_transport: bool,
        public_transport_jurisdiction: Option<i8>,
        route_name: String,
        vehicle_plate: Option<String>,
        vehicle_type_inep: Option<i32>,
        has_curricular_attendance: bool,
        didactic_mediation: String,
        country: String,
    }

    let rows = sqlx::query_as::<_, ExportRow>(
        "SELECT st.id AS student_id, st.full_name AS student_name, sc.name AS school_name,
                a.shift, a.uses_rural_transport, a.public_transport_jurisdiction,
                r.name AS route_name, v.plate AS vehicle_plate,
                v.vehicle_type_inep,
                e.has_curricular_attendance, e.didactic_mediation, e.country
         FROM transport_allocations a
         JOIN students st ON st.id = a.student_id
         JOIN enrollments e ON e.id = a.enrollment_id
         JOIN schools sc ON sc.id = e.school_id
         JOIN transport_routes r ON r.id = a.route_id
         LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
         WHERE e.academic_year_id = ? AND a.end_date IS NULL
         ORDER BY st.full_name",
    )
    .bind(&query.academic_year_id)
    .fetch_all(&state.pool)
    .await?;

    let mut writer = csv::Writer::from_writer(Vec::new());
    writer
        .write_record([
            "student_id",
            "student_name",
            "school",
            "academic_year",
            "shift",
            "uses_rural_transport",
            "public_transport_jurisdiction",
            "route",
            "vehicle_plate",
            "vehicle_type_inep",
            "transporte_publico",
            "poder_publico_responsavel_transporte",
            "veiculo_van_konbi",
            "veiculo_microonibus",
            "veiculo_onibus",
            "veiculo_bicicleta",
            "veiculo_tracao_animal",
            "veiculo_outro",
            "veiculo_aquaviario_ate_5",
            "veiculo_aquaviario_5_15",
            "veiculo_aquaviario_15_35",
            "veiculo_aquaviario_acima_35",
            "veiculo_ferroviario",
        ])
        .map_err(|err| AppError::internal(err.to_string()))?;

    for row in rows {
        // Regra do Registro 60: a declaração é anulada quando a turma não tem
        // atendimento curricular, quando a mediação é a distância ou quando o
        // estudante reside fora do Brasil.
        let declared = record60_declared(
            row.has_curricular_attendance,
            &row.didactic_mediation,
            &row.country,
        );
        let jurisdiction = row.public_transport_jurisdiction.unwrap_or(0);
        let tipo = row.vehicle_type_inep.unwrap_or(0);
        let flag = |code: i32| {
            if !declared {
                ""
            } else if tipo == code {
                "1"
            } else {
                "0"
            }
        };

        writer
            .write_record([
                row.student_id,
                row.student_name,
                row.school_name,
                year.to_string(),
                row.shift,
                if row.uses_rural_transport { "1" } else { "0" }.to_string(),
                row.public_transport_jurisdiction
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                row.route_name,
                row.vehicle_plate.unwrap_or_default(),
                row.vehicle_type_inep
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                if !declared {
                    String::new()
                } else if jurisdiction > 0 {
                    "1".to_string()
                } else {
                    "0".to_string()
                },
                if declared {
                    jurisdiction.to_string()
                } else {
                    String::new()
                },
                flag(1).to_string(),
                flag(2).to_string(),
                flag(3).to_string(),
                flag(4).to_string(),
                flag(5).to_string(),
                flag(6).to_string(),
                flag(7).to_string(),
                flag(8).to_string(),
                flag(9).to_string(),
                flag(10).to_string(),
                flag(11).to_string(),
            ])
            .map_err(|err| AppError::internal(err.to_string()))?;
    }

    let bytes = writer
        .into_inner()
        .map_err(|err| AppError::internal(err.to_string()))?;
    let filename = format!("censo-transporte-{year}.csv");

    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
        ],
        bytes,
    )
        .into_response())
}
