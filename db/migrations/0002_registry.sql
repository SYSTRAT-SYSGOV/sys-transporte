-- Cadastro base: escolas, responsáveis, alunos, anos letivos e matrículas

CREATE TABLE schools (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inep_code VARCHAR(20) NULL,
    education_network VARCHAR(20) NOT NULL DEFAULT 'municipal',
    city VARCHAR(150) NULL,
    state_uf CHAR(2) NULL,
    address VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    UNIQUE KEY uq_schools_inep (inep_code),
    KEY idx_schools_name (name),
    CONSTRAINT chk_schools_network CHECK (education_network IN ('municipal', 'estadual', 'federal', 'privada'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardians (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    document VARCHAR(30) NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    UNIQUE KEY uq_guardians_document (document),
    KEY idx_guardians_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    document VARCHAR(30) NULL,
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    UNIQUE KEY uq_students_document (document),
    KEY idx_students_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_guardians (
    student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    guardian_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    relationship VARCHAR(60) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (student_id, guardian_id),
    CONSTRAINT fk_student_guardians_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_student_guardians_guardian FOREIGN KEY (guardian_id) REFERENCES guardians (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_years (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
    year INT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_academic_years_year (year),
    CONSTRAINT chk_academic_years_range CHECK (ends_on >= starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enrollments (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
    student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    school_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    academic_year_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    grade VARCHAR(80) NOT NULL,
    shift VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE NULL,
    close_reason VARCHAR(255) NULL,
    active_key TINYINT GENERATED ALWAYS AS (IF(status = 'active' AND deleted_at IS NULL, 1, NULL)) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    UNIQUE KEY uq_enrollments_active (student_id, school_id, academic_year_id, active_key),
    KEY idx_enrollments_school (school_id),
    KEY idx_enrollments_year (academic_year_id),
    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_enrollments_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE RESTRICT,
    CONSTRAINT fk_enrollments_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT,
    CONSTRAINT chk_enrollments_shift CHECK (shift IN ('morning', 'afternoon', 'night', 'full_day')),
    CONSTRAINT chk_enrollments_status CHECK (status IN ('active', 'closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
