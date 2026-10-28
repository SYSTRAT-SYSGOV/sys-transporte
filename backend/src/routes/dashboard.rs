use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use sqlx::FromRow;

use crate::{
    auth::{
        perms::{DASHBOARD_READ, VEHICLE_READ},
        AuthUser,
    },
    domain::occupancy_percentage,
    error::AppResult,
    routes::fleet::{collect_driver_alerts, collect_vehicle_alerts, AlertDto},
    state::AppState,
};

pub fn router() -> Router<AppState> {
    Router::new().route("/summary", get(summary))
}

#[derive(Debug, Serialize)]
pub struct Counts {
    pub schools: i64,
    pub students: i64,
    pub routes: i64,
    pub vehicles: i64,
    pub drivers: i64,
    pub allocations: i64,
}

#[derive(Debug, Serialize)]
pub struct OccupancyItem {
    pub route_id: String,
    pub name: String,
    pub school_name: String,
    pub capacity: Option<i32>,
    pub allocated_students: i64,
    pub occupancy_percentage: Option<f64>,
    pub status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct Summary {
    pub counts: Counts,
    pub occupancy: Vec<OccupancyItem>,
    pub alerts: Vec<AlertDto>,
}

#[derive(Debug, FromRow)]
struct OccupancyRow {
    route_id: String,
    name: String,
    school_name: String,
    capacity: Option<i32>,
    allocated_students: i64,
}

pub async fn summary(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Summary>> {
    auth.require(DASHBOARD_READ)?;

    let schools: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL")
        .fetch_one(&state.pool)
        .await?;
    let students: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM students WHERE deleted_at IS NULL")
            .fetch_one(&state.pool)
            .await?;
    let routes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_routes WHERE deleted_at IS NULL AND is_active = TRUE",
    )
    .fetch_one(&state.pool)
    .await?;
    let vehicles: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_vehicles WHERE deleted_at IS NULL AND is_active = TRUE",
    )
    .fetch_one(&state.pool)
    .await?;
    let drivers: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_drivers WHERE deleted_at IS NULL AND is_active = TRUE",
    )
    .fetch_one(&state.pool)
    .await?;
    let allocations: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM transport_allocations WHERE end_date IS NULL")
            .fetch_one(&state.pool)
            .await?;

    let rows = sqlx::query_as::<_, OccupancyRow>(
        "SELECT r.id AS route_id, r.name, sc.name AS school_name,
                v.passenger_capacity AS capacity,
                (SELECT COUNT(*) FROM transport_allocations a
                  WHERE a.route_id = r.id AND a.end_date IS NULL) AS allocated_students
         FROM transport_routes r
         JOIN schools sc ON sc.id = r.school_id
         LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
         WHERE r.deleted_at IS NULL AND r.is_active = TRUE
         ORDER BY r.name",
    )
    .fetch_all(&state.pool)
    .await?;

    let occupancy = rows
        .into_iter()
        .map(|row| {
            let percentage =
                occupancy_percentage(row.allocated_students, row.capacity.unwrap_or(0) as i64);
            let status = match percentage {
                None => "unknown",
                Some(value) if value > 100.0 => "critical",
                Some(value) if value > 80.0 => "warning",
                Some(_) => "ok",
            };
            OccupancyItem {
                route_id: row.route_id,
                name: row.name,
                school_name: row.school_name,
                capacity: row.capacity,
                allocated_students: row.allocated_students,
                occupancy_percentage: percentage,
                status,
            }
        })
        .collect();

    let mut alerts = collect_driver_alerts(&state.pool).await?;
    if auth.can(VEHICLE_READ) {
        alerts.extend(collect_vehicle_alerts(&state.pool).await?);
    }
    alerts.sort_by_key(|alert| alert.days_left);

    Ok(Json(Summary {
        counts: Counts {
            schools,
            students,
            routes,
            vehicles,
            drivers,
            allocations,
        },
        occupancy,
        alerts,
    }))
}
