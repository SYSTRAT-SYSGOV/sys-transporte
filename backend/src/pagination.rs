use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Deserialize)]
pub struct PageQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ListQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
}

impl ListQuery {
    pub fn pagination(&self) -> AppResult<Pagination> {
        Pagination::from_query(&PageQuery {
            page: self.page,
            per_page: self.per_page,
        })
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Pagination {
    pub page: i64,
    pub per_page: i64,
    pub offset: i64,
}

impl Pagination {
    pub fn from_query(query: &PageQuery) -> AppResult<Self> {
        let page = query.page.unwrap_or(1);
        let per_page = query.per_page.unwrap_or(25);
        if page < 1 {
            return Err(AppError::validation_single(
                "page",
                "deve ser maior ou igual a 1",
            ));
        }
        if !(1..=100).contains(&per_page) {
            return Err(AppError::validation_single(
                "per_page",
                "deve estar entre 1 e 100",
            ));
        }
        Ok(Self {
            page,
            per_page,
            offset: (page - 1) * per_page,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
}

impl<T> Page<T> {
    pub fn new(items: Vec<T>, pagination: Pagination, total: i64) -> Self {
        Self {
            items,
            page: pagination.page,
            per_page: pagination.per_page,
            total,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_and_limits() {
        let p = Pagination::from_query(&PageQuery {
            page: None,
            per_page: None,
        })
        .unwrap();
        assert_eq!(p.page, 1);
        assert_eq!(p.per_page, 25);
        assert_eq!(p.offset, 0);

        let p = Pagination::from_query(&PageQuery {
            page: Some(3),
            per_page: Some(50),
        })
        .unwrap();
        assert_eq!(p.offset, 100);

        assert!(Pagination::from_query(&PageQuery {
            page: Some(0),
            per_page: None
        })
        .is_err());
        assert!(Pagination::from_query(&PageQuery {
            page: None,
            per_page: Some(101)
        })
        .is_err());
    }
}
