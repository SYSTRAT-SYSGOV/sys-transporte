-- Alinhamento com os contratos do legado (i-Educar / Censo Registro 60)

-- Data de habilitação (dt_habilitacao no legado).
ALTER TABLE transport_drivers
    ADD COLUMN cnh_first_issue_date DATE NULL AFTER cnh_category;

-- Data da licença e condutor padrão do veículo.
ALTER TABLE transport_vehicles
    ADD COLUMN default_driver_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER company_id,
    ADD COLUMN data_licenca DATE NULL AFTER renavam,
    ADD KEY idx_vehicles_default_driver (default_driver_id),
    ADD CONSTRAINT fk_vehicles_default_driver FOREIGN KEY (default_driver_id)
        REFERENCES transport_drivers (id) ON DELETE SET NULL;

-- Condições que anulam a declaração de transporte público no Registro 60.
ALTER TABLE enrollments
    ADD COLUMN has_curricular_attendance BOOLEAN NOT NULL DEFAULT TRUE AFTER shift,
    ADD COLUMN didactic_mediation VARCHAR(20) NOT NULL DEFAULT 'presencial' AFTER has_curricular_attendance,
    ADD COLUMN country CHAR(2) NOT NULL DEFAULT 'BR' AFTER didactic_mediation,
    ADD CONSTRAINT chk_enrollments_mediation
        CHECK (didactic_mediation IN ('presencial', 'semipresencial', 'distancia'));
