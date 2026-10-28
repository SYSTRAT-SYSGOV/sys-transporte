use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;

use crate::{auth::hash_password, config::Config};

const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0001_identity",
        include_str!("../../db/migrations/0001_identity.sql"),
    ),
    (
        "0002_registry",
        include_str!("../../db/migrations/0002_registry.sql"),
    ),
    (
        "0003_fleet",
        include_str!("../../db/migrations/0003_fleet.sql"),
    ),
    (
        "0004_routing",
        include_str!("../../db/migrations/0004_routing.sql"),
    ),
    (
        "0005_allocation",
        include_str!("../../db/migrations/0005_allocation.sql"),
    ),
    (
        "0006_audit_append_only",
        include_str!("../../db/migrations/0006_audit_append_only.sql"),
    ),
    (
        "0007_audit_no_delete",
        include_str!("../../db/migrations/0007_audit_no_delete.sql"),
    ),
    (
        "0008_legacy_alignment",
        include_str!("../../db/migrations/0008_legacy_alignment.sql"),
    ),
];

pub async fn connect(database_url: &str) -> Result<MySqlPool, sqlx::Error> {
    MySqlPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(10))
        .connect(database_url)
        .await
}

fn split_statements(sql: &str) -> Vec<String> {
    let without_comments = sql
        .lines()
        .filter(|line| !line.trim_start().starts_with("--"))
        .collect::<Vec<_>>()
        .join("\n");
    without_comments
        .split(';')
        .map(str::trim)
        .filter(|statement| !statement.is_empty())
        .map(str::to_string)
        .collect()
}

pub async fn run_migrations(pool: &MySqlPool) -> Result<usize, sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(100) NOT NULL PRIMARY KEY,
            applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB",
    )
    .execute(pool)
    .await?;

    let mut applied = 0;
    for (version, sql) in MIGRATIONS {
        let exists: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM schema_migrations WHERE version = ?")
                .bind(version)
                .fetch_one(pool)
                .await?;
        if exists > 0 {
            continue;
        }
        for statement in split_statements(sql) {
            sqlx::raw_sql(&statement).execute(pool).await?;
        }
        sqlx::query("INSERT INTO schema_migrations (version) VALUES (?)")
            .bind(version)
            .execute(pool)
            .await?;
        applied += 1;
    }
    Ok(applied)
}

pub const PERMISSIONS: &[(&str, &str)] = &[
    ("identity.user.manage", "Administrar usuários"),
    ("identity.role.manage", "Administrar papéis e permissões"),
    ("identity.audit.read", "Consultar trilha de auditoria"),
    ("registry.school.read", "Consultar escolas"),
    ("registry.school.manage", "Administrar escolas"),
    ("registry.student.read", "Consultar alunos"),
    (
        "registry.student.manage",
        "Administrar alunos e responsáveis",
    ),
    ("registry.enrollment.read", "Consultar matrículas"),
    ("registry.enrollment.manage", "Administrar matrículas"),
    ("transport.company.read", "Consultar empresas de transporte"),
    (
        "transport.company.manage",
        "Administrar empresas de transporte",
    ),
    ("transport.driver.read", "Consultar motoristas"),
    ("transport.driver.manage", "Administrar motoristas"),
    ("transport.vehicle.read", "Consultar veículos"),
    ("transport.vehicle.manage", "Administrar veículos"),
    ("transport.inspection.read", "Consultar vistorias"),
    ("transport.inspection.manage", "Registrar vistorias"),
    ("transport.stop.read", "Consultar pontos de parada"),
    ("transport.stop.manage", "Administrar pontos de parada"),
    ("transport.route.read", "Consultar rotas"),
    ("transport.route.manage", "Administrar rotas e itinerários"),
    (
        "transport.allocation.read",
        "Consultar alocações de estudantes",
    ),
    (
        "transport.allocation.manage",
        "Administrar alocações de estudantes",
    ),
    (
        "transport.allocation.override_capacity",
        "Autorizar alocação acima da capacidade",
    ),
    ("transport.census.read", "Consultar validação do Censo"),
    ("transport.census.export", "Exportar dados do Censo"),
    ("transport.dashboard.read", "Acessar painel operacional"),
];

const MANAGER_PERMISSIONS: &[&str] = &[
    "registry.school.read",
    "registry.school.manage",
    "registry.student.read",
    "registry.student.manage",
    "registry.enrollment.read",
    "registry.enrollment.manage",
    "transport.company.read",
    "transport.company.manage",
    "transport.driver.read",
    "transport.driver.manage",
    "transport.vehicle.read",
    "transport.vehicle.manage",
    "transport.inspection.read",
    "transport.inspection.manage",
    "transport.stop.read",
    "transport.stop.manage",
    "transport.route.read",
    "transport.route.manage",
    "transport.allocation.read",
    "transport.allocation.manage",
    "transport.allocation.override_capacity",
    "transport.census.read",
    "transport.census.export",
    "transport.dashboard.read",
];

const OPERATOR_PERMISSIONS: &[&str] = &[
    "registry.school.read",
    "registry.student.read",
    "registry.enrollment.read",
    "transport.company.read",
    "transport.driver.read",
    "transport.vehicle.read",
    "transport.inspection.read",
    "transport.stop.read",
    "transport.route.read",
    "transport.allocation.read",
    "transport.allocation.manage",
    "transport.census.read",
    "transport.dashboard.read",
];

const AUDITOR_PERMISSIONS: &[&str] = &[
    "identity.audit.read",
    "registry.school.read",
    "registry.student.read",
    "registry.enrollment.read",
    "transport.company.read",
    "transport.driver.read",
    "transport.vehicle.read",
    "transport.inspection.read",
    "transport.stop.read",
    "transport.route.read",
    "transport.allocation.read",
    "transport.census.read",
    "transport.dashboard.read",
];

pub async fn seed(pool: &MySqlPool, config: &Config) -> Result<(), sqlx::Error> {
    for (code, description) in PERMISSIONS {
        sqlx::query(
            "INSERT INTO permissions (code, description) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE description = VALUES(description)",
        )
        .bind(code)
        .bind(description)
        .execute(pool)
        .await?;
    }

    let all_permissions = PERMISSIONS
        .iter()
        .map(|(code, _)| *code)
        .collect::<Vec<_>>();
    let roles: [(&str, &str, &str, Vec<&str>); 4] = [
        (
            "admin",
            "Administrador",
            "Acesso completo ao sistema",
            all_permissions.clone(),
        ),
        (
            "manager",
            "Gestor de transporte",
            "Gestão operacional e cadastral",
            MANAGER_PERMISSIONS.to_vec(),
        ),
        (
            "operator",
            "Operador",
            "Operação diária de alocações",
            OPERATOR_PERMISSIONS.to_vec(),
        ),
        (
            "auditor",
            "Auditor",
            "Consulta e auditoria",
            AUDITOR_PERMISSIONS.to_vec(),
        ),
    ];

    for (code, name, description, permissions) in roles {
        sqlx::query(
            "INSERT INTO roles (id, code, name, description, is_system) VALUES (?, ?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
        )
        .bind(uuid::Uuid::now_v7().to_string())
        .bind(code)
        .bind(name)
        .bind(description)
        .execute(pool)
        .await?;

        let role_id: String = sqlx::query_scalar("SELECT id FROM roles WHERE code = ?")
            .bind(code)
            .fetch_one(pool)
            .await?;

        for permission in permissions {
            sqlx::query(
                "INSERT IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)",
            )
            .bind(&role_id)
            .bind(permission)
            .execute(pool)
            .await?;
        }
    }

    let existing_admins: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'admin' AND u.deleted_at IS NULL",
    )
    .fetch_one(pool)
    .await?;

    if existing_admins == 0 {
        if let Some(password) = &config.admin_password {
            let hash = hash_password(password)
                .map_err(|err| sqlx::Error::Protocol(format!("hash do administrador: {err}")))?;
            let user_id = uuid::Uuid::now_v7().to_string();
            sqlx::query(
                "INSERT INTO users (id, email, password_hash, full_name, is_active)
                 VALUES (?, ?, ?, ?, TRUE)",
            )
            .bind(&user_id)
            .bind(&config.admin_email)
            .bind(hash)
            .bind(&config.admin_name)
            .execute(pool)
            .await?;
            let role_id: String = sqlx::query_scalar("SELECT id FROM roles WHERE code = 'admin'")
                .fetch_one(pool)
                .await?;
            sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
                .bind(&user_id)
                .bind(&role_id)
                .execute(pool)
                .await?;
            tracing::info!(email = %config.admin_email, "usuário administrador criado");
        } else {
            tracing::warn!(
                "nenhum administrador existe e ADMIN_PASSWORD não foi definida; o acesso ficará indisponível"
            );
        }
    }

    if config.seed_demo {
        seed_demo(pool).await?;
    }

    Ok(())
}

async fn seed_demo(pool: &MySqlPool) -> Result<(), sqlx::Error> {
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM schools")
        .fetch_one(pool)
        .await?;
    if existing > 0 {
        return Ok(());
    }

    let today = Utc::now().date_naive();
    let year = today
        .format("%Y")
        .to_string()
        .parse::<i32>()
        .unwrap_or(2026);
    let year_id = uuid::Uuid::now_v7().to_string();
    sqlx::query(
        "INSERT INTO academic_years (id, year, starts_on, ends_on, is_active) VALUES (?, ?, ?, ?, TRUE)",
    )
    .bind(&year_id)
    .bind(year)
    .bind(chrono::NaiveDate::from_ymd_opt(year, 2, 1).unwrap())
    .bind(chrono::NaiveDate::from_ymd_opt(year, 12, 15).unwrap())
    .execute(pool)
    .await?;

    let mut school_ids = Vec::new();
    for (name, inep, city) in [
        ("Escola Municipal São José", "33000001", "Rio de Janeiro"),
        ("Escola Rural Boa Esperança", "33000002", "Nova Friburgo"),
    ] {
        let id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO schools (id, name, inep_code, education_network, city, state_uf)
             VALUES (?, ?, ?, 'municipal', ?, 'RJ')",
        )
        .bind(&id)
        .bind(name)
        .bind(inep)
        .bind(city)
        .execute(pool)
        .await?;
        school_ids.push(id);
    }

    let company_id = uuid::Uuid::now_v7().to_string();
    sqlx::query(
        "INSERT INTO transport_companies
         (id, legal_name, cnpj, contract_number, contract_start_date, contract_end_date, responsible_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&company_id)
    .bind("Transportes Serrano Ltda")
    .bind("12.345.678/0001-90")
    .bind("CONTRATO-2026-01")
    .bind(today - ChronoDuration::days(120))
    .bind(today + ChronoDuration::days(240))
    .bind("Maria Serrana")
    .execute(pool)
    .await?;

    let mut driver_ids = Vec::new();
    for (name, cpf, cnh, category) in [
        ("Carlos Pereira", "111.222.333-44", "12345678901", "D"),
        ("Ana Souza", "555.666.777-88", "98765432109", "E"),
    ] {
        let id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO transport_drivers
             (id, company_id, full_name, cpf, birth_date, cnh_number, cnh_category,
              cnh_expiration_date, course_certificate, course_expiration_date,
              toxicological_exam_date, toxicological_expiration_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&company_id)
        .bind(name)
        .bind(cpf)
        .bind(chrono::NaiveDate::from_ymd_opt(1985, 4, 12).unwrap())
        .bind(cnh)
        .bind(category)
        .bind(today + ChronoDuration::days(400))
        .bind("CURSO-2025")
        .bind(today + ChronoDuration::days(300))
        .bind(today - ChronoDuration::days(30))
        .bind(today + ChronoDuration::days(335))
        .execute(pool)
        .await?;
        driver_ids.push(id);
    }

    let mut vehicle_ids = Vec::new();
    for (description, plate, capacity, accessible, inep) in [
        ("Ônibus escolar 01", "ABC1D23", 44, true, 3),
        ("Van rural 02", "XYZ9876", 16, false, 1),
    ] {
        let id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO transport_vehicles
             (id, company_id, description, plate, renavam, brand_model, manufacture_year,
              model_year, passenger_capacity, network_type, vehicle_type_inep,
              is_exclusive_school_use, is_accessible_disability,
              last_inspection_date, inspection_certificate_number, inspection_valid_until)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&company_id)
        .bind(description)
        .bind(plate)
        .bind("00123456789")
        .bind("Marcopolo Volare")
        .bind(2020)
        .bind(2021)
        .bind(capacity)
        .bind(if inep == 1 { "rural" } else { "mixed" })
        .bind(inep)
        .bind(accessible)
        .bind(today - ChronoDuration::days(60))
        .bind(format!("VIST-{plate}"))
        .bind(today + ChronoDuration::days(120))
        .execute(pool)
        .await?;
        vehicle_ids.push(id);
    }

    let mut stop_ids = Vec::new();
    for (name, lat, lon) in [
        ("Praça Central", -22.9068, -43.1729),
        ("Bairro Alto", -22.8900, -43.2000),
        ("Ponte do Rio", -22.8700, -43.2100),
        ("Vila Rural", -22.1200, -42.5400),
    ] {
        let id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO transport_stops (id, name, latitude, longitude, city, state_uf)
             VALUES (?, ?, ?, ?, 'Rio de Janeiro', 'RJ')",
        )
        .bind(&id)
        .bind(name)
        .bind(lat)
        .bind(lon)
        .execute(pool)
        .await?;
        stop_ids.push(id);
    }

    let mut route_ids = Vec::new();
    for (name, school_idx, vehicle_idx, driver_idx, km_paved, km_unpaved) in [
        ("Rota Central", 0usize, 0usize, 0usize, 12.5, 7.25),
        ("Rota Rural", 1usize, 1usize, 1usize, 3.0, 22.0),
    ] {
        let id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO transport_routes
             (id, school_id, academic_year_id, company_id, vehicle_id, driver_id, name, shift,
              route_type, km_paved, km_unpaved, departure_time, arrival_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'morning', ?, ?, ?, '06:30:00', '07:20:00')",
        )
        .bind(&id)
        .bind(&school_ids[school_idx])
        .bind(&year_id)
        .bind(&company_id)
        .bind(&vehicle_ids[vehicle_idx])
        .bind(&driver_ids[driver_idx])
        .bind(name)
        .bind(if school_idx == 0 { "urban" } else { "rural" })
        .bind(km_paved)
        .bind(km_unpaved)
        .execute(pool)
        .await?;

        for (order, stop_idx) in [0usize, 1usize, 2usize].iter().enumerate() {
            let stop_index = (stop_idx + school_idx) % stop_ids.len();
            sqlx::query(
                "INSERT INTO transport_route_stops (id, route_id, stop_id, sequence_order)
                 VALUES (?, ?, ?, ?)",
            )
            .bind(uuid::Uuid::now_v7().to_string())
            .bind(&id)
            .bind(&stop_ids[stop_index])
            .bind((order + 1) as i32)
            .execute(pool)
            .await?;
        }
        route_ids.push(id);
    }

    for index in 0..6usize {
        let student_id = uuid::Uuid::now_v7().to_string();
        let guardian_id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO guardians (id, full_name, document, phone)
             VALUES (?, ?, ?, '(21) 90000-0000')",
        )
        .bind(&guardian_id)
        .bind(format!("Responsável {index}"))
        .bind(format!("DOC-{index:04}"))
        .execute(pool)
        .await?;
        sqlx::query(
            "INSERT INTO students (id, full_name, birth_date, is_active)
             VALUES (?, ?, ?, TRUE)",
        )
        .bind(&student_id)
        .bind(format!("Estudante Demonstração {index}"))
        .bind(chrono::NaiveDate::from_ymd_opt(2010 + (index % 5) as i32, 3, 10).unwrap())
        .execute(pool)
        .await?;
        sqlx::query(
            "INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
             VALUES (?, ?, 'Mãe', TRUE)",
        )
        .bind(&student_id)
        .bind(&guardian_id)
        .execute(pool)
        .await?;

        let school_index = index % 2;
        let enrollment_id = uuid::Uuid::now_v7().to_string();
        sqlx::query(
            "INSERT INTO enrollments
             (id, student_id, school_id, academic_year_id, grade, shift, status, start_date)
             VALUES (?, ?, ?, ?, '5º ano', 'morning', 'active', ?)",
        )
        .bind(&enrollment_id)
        .bind(&student_id)
        .bind(&school_ids[school_index])
        .bind(&year_id)
        .bind(chrono::NaiveDate::from_ymd_opt(year, 2, 1).unwrap())
        .execute(pool)
        .await?;

        let route_index = index % 2;
        sqlx::query(
            "INSERT INTO transport_allocations
             (id, student_id, enrollment_id, route_id, shift, uses_rural_transport,
              public_transport_jurisdiction, special_needs_transport, start_date)
             VALUES (?, ?, ?, ?, 'morning', ?, 2, FALSE, ?)",
        )
        .bind(uuid::Uuid::now_v7().to_string())
        .bind(&student_id)
        .bind(&enrollment_id)
        .bind(&route_ids[route_index])
        .bind(route_index == 1)
        .bind(chrono::NaiveDate::from_ymd_opt(year, 2, 1).unwrap())
        .execute(pool)
        .await?;
    }

    tracing::info!("dados de demonstração criados");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_statements_without_comments() {
        let statements =
            split_statements("-- comentário\nCREATE TABLE a (id INT);\n\nCREATE TABLE b (id INT);");
        assert_eq!(statements.len(), 2);
        assert!(statements[0].starts_with("CREATE TABLE a"));
    }

    #[test]
    fn every_permission_is_unique() {
        let mut codes = PERMISSIONS
            .iter()
            .map(|(code, _)| *code)
            .collect::<Vec<_>>();
        let total = codes.len();
        codes.sort_unstable();
        codes.dedup();
        assert_eq!(codes.len(), total);
    }
}
