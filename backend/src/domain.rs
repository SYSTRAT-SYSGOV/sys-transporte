use chrono::{Datelike, NaiveDate};

use crate::error::FieldError;

pub const SHIFTS: [&str; 4] = ["morning", "afternoon", "night", "full_day"];
pub const NETWORK_TYPES: [&str; 3] = ["rural", "urban", "mixed"];

pub fn shift_valid(value: &str) -> bool {
    SHIFTS.contains(&value)
}

pub fn network_type_valid(value: &str) -> bool {
    NETWORK_TYPES.contains(&value)
}

/// Normaliza a placa removendo separadores e aplicando caixa alta.
pub fn normalize_plate(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_uppercase()
}

/// Aceita o padrão Mercosul (ABC1D23) e o antigo (ABC1234).
pub fn plate_valid(plate: &str) -> bool {
    let normalized = normalize_plate(plate);
    if normalized.len() != 7 {
        return false;
    }
    let bytes = normalized.as_bytes();
    bytes[..3].iter().all(|b| b.is_ascii_uppercase())
        && bytes[3..]
            .iter()
            .all(|b| b.is_ascii_digit() || b.is_ascii_uppercase())
        && bytes[3..].iter().any(|b| b.is_ascii_digit())
}

pub fn validate_coordinates(lat: Option<f64>, lon: Option<f64>) -> Vec<FieldError> {
    let mut errors = Vec::new();
    if let Some(lat) = lat {
        if !(-90.0..=90.0).contains(&lat) {
            errors.push(FieldError::new("latitude", "deve estar entre -90 e 90"));
        }
    }
    if let Some(lon) = lon {
        if !(-180.0..=180.0).contains(&lon) {
            errors.push(FieldError::new("longitude", "deve estar entre -180 e 180"));
        }
    }
    errors
}

/// Percentual de ocupação arredondado a duas casas. `None` quando não há capacidade.
pub fn occupancy_percentage(allocated: i64, capacity: i64) -> Option<f64> {
    if capacity <= 0 {
        return None;
    }
    let value = (allocated as f64 / capacity as f64) * 100.0;
    Some((value * 100.0).round() / 100.0)
}

pub fn age_on(birth: NaiveDate, today: NaiveDate) -> i32 {
    let mut age = today.year() - birth.year();
    if (today.month(), today.day()) < (birth.month(), birth.day()) {
        age -= 1;
    }
    age
}

pub fn contract_valid(end: Option<NaiveDate>, today: NaiveDate) -> bool {
    end.map(|d| d >= today).unwrap_or(true)
}

pub fn inspection_valid(valid_until: Option<NaiveDate>, today: NaiveDate) -> bool {
    valid_until.map(|d| d >= today).unwrap_or(false)
}

/// Regra do Censo Escolar (Registro 60): a declaração de transporte público só
/// é emitida para turma com atendimento curricular, mediação presencial ou
/// semipresencial e residência no Brasil.
pub fn record60_declared(
    has_curricular_attendance: bool,
    didactic_mediation: &str,
    country: &str,
) -> bool {
    has_curricular_attendance
        && didactic_mediation != "distancia"
        && country.eq_ignore_ascii_case("BR")
}

#[derive(Debug, Clone)]
pub struct DriverEligibility<'a> {
    pub cnh_category: &'a str,
    pub cnh_expiration: NaiveDate,
    pub birth_date: NaiveDate,
    pub course_expiration: Option<NaiveDate>,
    pub toxicological_expiration: Option<NaiveDate>,
    pub today: NaiveDate,
}

/// Retorna a lista de impedimentos legais do condutor (vazia quando elegível).
pub fn driver_issues(input: &DriverEligibility<'_>) -> Vec<String> {
    let mut issues = Vec::new();
    if !matches!(input.cnh_category, "D" | "E") {
        issues.push("CNH deve ser das categorias D ou E".to_string());
    }
    if age_on(input.birth_date, input.today) <= 21 {
        issues.push("Condutor deve ter mais de 21 anos".to_string());
    }
    if input.cnh_expiration < input.today {
        issues.push("CNH vencida".to_string());
    }
    match input.course_expiration {
        Some(date) if date >= input.today => {}
        Some(_) => issues.push("Curso especializado vencido".to_string()),
        None => issues.push("Curso especializado não informado".to_string()),
    }
    match input.toxicological_expiration {
        Some(date) if date >= input.today => {}
        Some(_) => issues.push("Exame toxicológico vencido".to_string()),
        None => issues.push("Exame toxicológico não informado".to_string()),
    }
    issues
}

pub fn document_days_left(expiration: NaiveDate, today: NaiveDate) -> i64 {
    (expiration - today).num_days()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn normalizes_plate_to_uppercase_without_separators() {
        assert_eq!(normalize_plate("abc1d23"), "ABC1D23");
        assert_eq!(normalize_plate("abc-1234"), "ABC1234");
        assert!(plate_valid("ABC1D23"));
        assert!(plate_valid("ABC-1234"));
        assert!(!plate_valid("AB1234"));
    }

    #[test]
    fn occupancy_rounds_to_two_decimals() {
        assert_eq!(occupancy_percentage(20, 40), Some(50.0));
        assert_eq!(occupancy_percentage(1, 3), Some(33.33));
        assert_eq!(occupancy_percentage(5, 0), None);
    }

    #[test]
    fn rejects_invalid_coordinates() {
        assert!(validate_coordinates(Some(-91.0), None).len() == 1);
        assert!(validate_coordinates(None, Some(181.0)).len() == 1);
        assert!(validate_coordinates(Some(-23.5), Some(-46.6)).is_empty());
    }

    #[test]
    fn driver_eligibility_checks_all_legal_requirements() {
        let today = date(2026, 10, 20);
        let ok = DriverEligibility {
            cnh_category: "D",
            cnh_expiration: date(2028, 1, 1),
            birth_date: date(1990, 5, 10),
            course_expiration: Some(date(2027, 1, 1)),
            toxicological_expiration: Some(date(2027, 6, 1)),
            today,
        };
        assert!(driver_issues(&ok).is_empty());

        let bad = DriverEligibility {
            cnh_category: "B",
            cnh_expiration: date(2025, 1, 1),
            birth_date: date(2010, 5, 10),
            course_expiration: None,
            toxicological_expiration: Some(date(2025, 1, 1)),
            today,
        };
        assert_eq!(driver_issues(&bad).len(), 5);
    }

    #[test]
    fn contract_and_inspection_validity() {
        let today = date(2026, 10, 20);
        assert!(contract_valid(None, today));
        assert!(contract_valid(Some(today), today));
        assert!(!contract_valid(Some(date(2026, 10, 19)), today));
        assert!(inspection_valid(Some(date(2027, 1, 1)), today));
        assert!(!inspection_valid(None, today));
    }

    #[test]
    fn record60_declaration_follows_legacy_nulling_rules() {
        assert!(record60_declared(true, "presencial", "BR"));
        assert!(record60_declared(true, "semipresencial", "br"));
        assert!(!record60_declared(false, "presencial", "BR"));
        assert!(!record60_declared(true, "distancia", "BR"));
        assert!(!record60_declared(true, "presencial", "PY"));
    }
}
