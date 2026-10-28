# Mapeamento do Módulo: Transport (Transporte Escolar Público)

> Mapeamento de engenharia reversa do i-Educar para o submódulo **`SYS-Educa`** no ecossistema multi-tenant **SYSGOV**.

---

## 1. Visão Geral e Contexto Regulatório

O módulo **Transporte Escolar** atende à gestão de transporte de estudantes da rede pública, com foco na garantia de acesso e permanência na escola (especialmente em áreas rurais e de difícil acesso). O módulo é pautado pelas seguintes legislações e exigências técnicas federais:

1. **Programa Nacional de Apoio ao Transporte do Escolar (PNATE / FNDE - Lei nº 10.880/2004):** Repasse de recursos federais calculados pelo número de alunos transportados em áreas rurais registrados no Censo Escolar.
2. **Código de Trânsito Brasileiro (CTB - Lei nº 9.503/1997, Arts. 136 a 139):**
   - Autorização do órgão estadual de trânsito (DETRAN) afixada na parte interna do veículo.
   - Vistoria semestral obrigatória de equipamentos obrigatórios e de segurança.
   - Requisitos para o condutor: idade superior a 21 anos, CNH categoria "D" ou "E", não ter cometido infração gravíssima nos últimos 12 meses, aprovação em curso especializado para condutores de escolares e exame toxicológico regular.
3. **Censo Escolar da Educação Básica (MEC/Inep - Registro 60):**
   - Declaração obrigatória se o estudante utiliza transporte escolar público (`0: Não`, `1: Sim`).
   - Identificação do Poder Público Responsável (`1: Estadual`, `2: Municipal`, `3: Compartilhado`).
   - Tipologia do modal utilizado:
     - *Rodoviário:* Van/Kombi (1), Micro-ônibus (2), Ônibus (3), Bicicleta (4), Tração Animal (5), Outro (6).
     - *Aquaviário:* Capacidade de até 5 alunos (7), 5 a 15 alunos (8), 15 a 35 alunos (9), acima de 35 alunos (10).
     - *Ferroviário:* Trem / Metrô (11).

---

## 2. Modelagem de Dados no SYSGOV (PostgreSQL 16+)

### 2.1 Tabela: `educa_transport_companies`
Armazena as pessoas jurídicas terceirizadas prestadoras de serviço ou a própria frota municipal direta.

```sql
CREATE TABLE educa_transport_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    legal_person_id UUID NOT NULL REFERENCES core_legal_entities(id), -- Integração com módulo de Cadastro SYSGOV
    responsible_person_id UUID REFERENCES core_people(id), -- Representante legal / Coordenador
    
    contract_number VARCHAR(100), -- Número do contrato de licitação
    contract_start_date DATE,
    contract_end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_educa_transport_comp_tenant ON educa_transport_companies(tenant_id);
```

---

### 2.2 Tabela: `educa_transport_drivers`
Registra os motoristas e condutores habilitados segundo o CTB.

```sql
CREATE TABLE educa_transport_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES core_people(id), -- Integração com Pessoa Física SYSGOV
    company_id UUID REFERENCES educa_transport_companies(id) ON DELETE SET NULL,
    
    cnh_number VARCHAR(30) NOT NULL,
    cnh_category VARCHAR(5) NOT NULL, -- 'D', 'E'
    cnh_first_issue_date DATE,
    cnh_expiration_date DATE NOT NULL,
    
    school_transport_course_certificate VARCHAR(100), -- Comprovante de curso do Contran
    course_expiration_date DATE,
    toxicological_exam_date DATE,
    toxicological_expiration_date DATE,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_educa_transport_drivers_tenant ON educa_transport_drivers(tenant_id);
CREATE INDEX idx_educa_transport_drivers_person ON educa_transport_drivers(person_id);
```

---

### 2.3 Tabela: `educa_transport_vehicles`
Registra a frota de veículos (ônibus, micro-ônibus, vans, barcos, etc.).

```sql
CREATE TABLE educa_transport_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_vehicle(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES educa_transport_companies(id) ON DELETE SET NULL,
    default_driver_id UUID REFERENCES educa_transport_drivers(id) ON DELETE SET NULL,
    
    description VARCHAR(255) NOT NULL,
    plate VARCHAR(10), -- Placa no padrão Mercosul ou antigo
    renavam VARCHAR(30),
    chassis VARCHAR(30),
    brand_model VARCHAR(150),
    manufacture_year INT,
    model_year INT,
    
    passenger_capacity INT NOT NULL DEFAULT 0,
    network_type VARCHAR(20) NOT NULL DEFAULT 'rural', -- 'rural', 'urban', 'mixed'
    vehicle_type_inep INT NOT NULL, -- Enum Censo Inep (1: Van, 2: Microonibus, 3: Onibus, etc.)
    
    is_exclusive_school_use BOOLEAN NOT NULL DEFAULT TRUE,
    is_accessible_disability BOOLEAN NOT NULL DEFAULT FALSE, -- Acessibilidade / Elevador PCD
    
    -- Vistoria DETRAN
    last_inspection_date DATE,
    inspection_certificate_number VARCHAR(100),
    inspection_valid_until DATE,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivation_reason TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_educa_transport_veh_tenant ON educa_transport_vehicles(tenant_id);
CREATE INDEX idx_educa_transport_veh_plate ON educa_transport_vehicles(tenant_id, plate);
```

---

### 2.4 Tabela: `educa_transport_stops`
Armazena os pontos georreferenciados de embarque e desembarque.

```sql
CREATE TABLE educa_transport_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Coordenadas Geográficas (Suporte GIS / PostGIS ou WGS84 numérico)
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    
    -- Endereço de Referência
    postal_code VARCHAR(9),
    street VARCHAR(255),
    number VARCHAR(30),
    complement VARCHAR(150),
    neighborhood VARCHAR(150),
    city_id UUID REFERENCES core_cities(id),
    state_uf VARCHAR(2),
    landmark TEXT, -- Ponto de referência visual (ex: 'Em frente ao posto de saúde da vila rural')
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_educa_transport_stops_tenant ON educa_transport_stops(tenant_id);
```

---

### 2.5 Tabela: `educa_transport_routes`
Registra a rota/itinerário que atende uma ou mais escolas de destino.

```sql
CREATE TABLE educa_transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES educa_schools(id), -- Escola de destino principal
    company_id UUID REFERENCES educa_transport_companies(id),
    vehicle_id UUID REFERENCES educa_transport_vehicles(id),
    driver_id UUID REFERENCES educa_transport_drivers(id),
    
    name VARCHAR(255) NOT NULL,
    academic_year INT NOT NULL, -- Ano de vigência da rota
    shift VARCHAR(20) NOT NULL, -- 'morning', 'afternoon', 'night', 'full_day'
    route_type VARCHAR(20) NOT NULL DEFAULT 'rural', -- 'rural', 'urban', 'mixed'
    
    km_paved NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    km_unpaved NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    total_km NUMERIC(8, 2) GENERATED ALWAYS AS (km_paved + km_unpaved) STORED,
    
    departure_time TIME,
    arrival_time TIME,
    return_departure_time TIME,
    
    is_outsourced BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_educa_transport_routes_tenant ON educa_transport_routes(tenant_id);
CREATE INDEX idx_educa_transport_routes_school ON educa_transport_routes(school_id);
```

---

### 2.6 Tabela: `educa_transport_route_stops`
Associa os pontos de parada ao itinerário da rota, definindo a ordem e estimativa de passagem.

```sql
CREATE TABLE educa_transport_route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES educa_transport_routes(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL REFERENCES educa_transport_stops(id) ON DELETE CASCADE,
    
    sequence_order INT NOT NULL, -- 1º Ponto, 2º Ponto, 3º Ponto...
    estimated_pickup_time TIME,
    estimated_dropoff_time TIME,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX unq_route_stop_sequence ON educa_transport_route_stops(route_id, sequence_order);
```

---

### 2.7 Tabela: `educa_transport_students`
Registra a alocação do estudante matriculado ao transporte escolar oficial.

```sql
CREATE TABLE educa_transport_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES educa_students(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES educa_registrations(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES educa_transport_routes(id) ON DELETE RESTRICT,
    stop_id UUID REFERENCES educa_transport_stops(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES educa_schools(id),
    
    shift VARCHAR(20) NOT NULL, -- 'morning', 'afternoon', 'night', 'full_day'
    uses_rural_transport BOOLEAN NOT NULL DEFAULT FALSE,
    public_transport_jurisdiction INT NOT NULL DEFAULT 2, -- Inep: 1: Estadual, 2: Municipal, 3: Compartilhado
    
    special_needs_transport BOOLEAN NOT NULL DEFAULT FALSE, -- Requer cuidador / veículo adaptado
    special_needs_notes TEXT,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_educa_transp_stud_tenant ON educa_transport_students(tenant_id);
CREATE INDEX idx_educa_transp_stud_route ON educa_transport_students(route_id);
CREATE INDEX idx_educa_transp_stud_student ON educa_transport_students(student_id);
```

---

## 3. Mapeamento de Campos: Legado i-Educar -> SYSGOV

| Entidade / Campo Legado (i-Educar) | Tabela / Coluna no SYSGOV (`SYS-Educa`) | Tipo Legado | Tipo SYSGOV | Regra de Transformação / Tratamento |
|---|---|---|---|---|
| `modules.empresa_transporte_escolar.cod_empresa_transporte_escolar` | `educa_transport_companies.id` | `serial / int` | `UUID` | Migração para UUID v4 com mapa de De/Para |
| `modules.empresa_transporte_escolar.ref_idpes` | `educa_transport_companies.legal_person_id` | `int` | `UUID` | FK para cadastro corporativo `core_legal_entities` |
| `modules.empresa_transporte_escolar.ref_resp_idpes` | `educa_transport_companies.responsible_person_id` | `int` | `UUID` | FK para pessoa física `core_people` |
| `modules.motorista.cod_motorista` | `educa_transport_drivers.id` | `serial / int` | `UUID` | Migração para UUID v4 |
| `modules.motorista.ref_idpes` | `educa_transport_drivers.person_id` | `int` | `UUID` | FK para condutor em `core_people` |
| `modules.motorista.cnh` | `educa_transport_drivers.cnh_number` | `varchar` | `VARCHAR(30)` | Higienização de numerais de CNH |
| `modules.motorista.tipo_cnh` | `educa_transport_drivers.cnh_category` | `varchar` | `VARCHAR(5)` | Validação de categoria ('D' ou 'E' para escolares) |
| `modules.veiculo.cod_veiculo` | `educa_transport_vehicles.id` | `serial / int` | `UUID` | Chave única UUID |
| `modules.veiculo.placa` | `educa_transport_vehicles.plate` | `varchar` | `VARCHAR(10)` | Padronização em maiúsculas (ex: Mercosul `ABC1D23`) |
| `modules.veiculo.passageiros` | `educa_transport_vehicles.passenger_capacity` | `int` | `INT` | Capacidade máxima de lotação |
| `modules.veiculo.exclusivo_transporte_escolar` | `educa_transport_vehicles.is_exclusive_school_use` | `char(1)` | `BOOLEAN` | Conversão `'S' -> TRUE`, `'N' -> FALSE` |
| `modules.veiculo.adaptado_necessidades_especiais` | `educa_transport_vehicles.is_accessible_disability` | `char(1)` | `BOOLEAN` | Conversão `'S' -> TRUE`, `'N' -> FALSE` |
| `modules.ponto_transporte_escolar.cod_ponto_transporte_escolar` | `educa_transport_stops.id` | `serial / int` | `UUID` | Ponto georreferenciado |
| `modules.ponto_transporte_escolar.latitude` | `educa_transport_stops.latitude` | `varchar` | `NUMERIC(10, 7)` | Cast seguro para coordenada numérica |
| `modules.ponto_transporte_escolar.longitude` | `educa_transport_stops.longitude` | `varchar` | `NUMERIC(10, 7)` | Cast seguro para coordenada numérica |
| `modules.rota_transporte_escolar.cod_rota_transporte_escolar` | `educa_transport_routes.id` | `serial / int` | `UUID` | Rota / linha |
| `modules.rota_transporte_escolar.km_pav` | `educa_transport_routes.km_paved` | `numeric` | `NUMERIC(8, 2)` | Extensão pavimentada |
| `modules.rota_transporte_escolar.km_npav` | `educa_transport_routes.km_unpaved` | `numeric` | `NUMERIC(8, 2)` | Extensão de terra / vicinal |
| `modules.pessoa_transporte.cod_pessoa_transporte` | `educa_transport_students.id` | `serial / int` | `UUID` | Registro de alocação de aluno |
| `pmieducar.aluno.veiculo_transporte_escolar` | `educa_transport_vehicles.vehicle_type_inep` | `int4[]` | `INT` | Array legado de inteiros mapeado para veículo real |
| `pmieducar.aluno.utiliza_transporte_rural` | `educa_transport_students.uses_rural_transport` | `smallint` | `BOOLEAN` | `1 -> TRUE`, `0 -> FALSE` |

---

## 4. Endpoints RESTful no Laravel 13

Localização no monorepo: `apps/api/modules/Educa/Http/Controllers/Transport/`

### 4.1 Veículos e Frotas
- `GET /api/v1/educa/transport/vehicles` — Listagem paginada de veículos com filtros (empresa, tipo Inep, acessível).
- `POST /api/v1/educa/transport/vehicles` — Cadastro de veículo com checagem de placa e validação de vistoria.
- `GET /api/v1/educa/transport/vehicles/{id}` — Detalhes completos do veículo e motorista padrão.
- `PUT /api/v1/educa/transport/vehicles/{id}` — Atualização cadastral.
- `POST /api/v1/educa/transport/vehicles/{id}/inspections` — Registro de nova vistoria semestral do DETRAN.

### 4.2 Condutores e Motoristas
- `GET /api/v1/educa/transport/drivers` — Listagem de motoristas e status de vencimento da CNH/exame toxicológico.
- `POST /api/v1/educa/transport/drivers` — Cadastro de motorista.
- `PUT /api/v1/educa/transport/drivers/{id}` — Atualização de dados de habilitação.

### 4.3 Rotas e Malha Viária
- `GET /api/v1/educa/transport/routes` — Listagem de rotas por ano letivo, escola e turno.
- `POST /api/v1/educa/transport/routes` — Criação de itinerário e associação de paradas ordenadas.
- `GET /api/v1/educa/transport/routes/{id}/occupancy` — Relatório de ocupação (capacidade vs alunos alocados).
- `GET /api/v1/educa/transport/stops` — Lista de pontos de parada (compatível com mapa GeoJSON).

### 4.4 Alocação de Estudantes
- `POST /api/v1/educa/transport/routes/{routeId}/students` — Alocar estudante a uma rota e ponto de parada.
- `DELETE /api/v1/educa/transport/routes/{routeId}/students/{studentId}` — Desvincular estudante da rota.
- `GET /api/v1/educa/transport/census/record60-validation` — Pré-validação de consistência para o Censo Escolar.

---

## 5. Contratos TypeScript no `@sysgov/sdk`

```typescript
export interface TransportVehicle {
  id: string;
  tenantId: string;
  companyId?: string;
  description: string;
  plate: string;
  renavam?: string;
  brandModel: string;
  manufactureYear: number;
  modelYear: number;
  passengerCapacity: number;
  networkType: 'rural' | 'urban' | 'mixed';
  vehicleTypeInep: number;
  isExclusiveSchoolUse: boolean;
  isAccessibleDisability: boolean;
  lastInspectionDate?: string;
  inspectionValidUntil?: string;
  isActive: boolean;
}

export interface TransportRoute {
  id: string;
  tenantId: string;
  schoolId: string;
  schoolName?: string;
  vehicleId?: string;
  vehicleDescription?: string;
  driverId?: string;
  driverName?: string;
  name: string;
  academicYear: number;
  shift: 'morning' | 'afternoon' | 'night' | 'full_day';
  routeType: 'rural' | 'urban' | 'mixed';
  kmPaved: number;
  kmUnpaved: number;
  totalKm: number;
  stopsCount: number;
  allocatedStudentsCount: number;
  capacityUtilizationPercentage: number;
  isActive: boolean;
}

export interface TransportStop {
  id: string;
  tenantId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  street?: string;
  neighborhood?: string;
  cityUf?: string;
  landmark?: string;
}

export interface TransportStudentAllocation {
  id: string;
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  stopId?: string;
  stopName?: string;
  shift: string;
  usesRuralTransport: boolean;
  publicTransportJurisdiction: number;
}
```

---

## 6. Requisitos de Frontend no `@sysgov/ui`

- **Visualização de Itinerário em Mapa Interativo:**
  - Renderização dos pontos de parada (`educa_transport_stops`) com marcadores ordenados (1, 2, 3...) sobre mapa (Leaflet/MapLibre).
  - Traçado de rota estimado entre os pontos e a escola de destino.
- **Painel de Lotação e Capacidade em Tempo Real:**
  - Barra de progresso visual de ocupação do veículo por turno:
    - *Verde:* Ocupação até 80%.
    - *Amarelo:* Ocupação entre 81% e 100%.
    - *Vermelho (Alerta):* Ocupação > 100% (Superlotação ilegal pelo CTB).
- **Cartões de Alerta de Fiscalização:**
  - Alerta de CNH a vencer nos próximos 30 dias.
  - Alerta de Vistoria Semestral do DETRAN expirada.
- **Formatação de Dados:**
  - Placas, RENAVAM e CNH sempre formatados com fonte técnica `JetBrains Mono`.
