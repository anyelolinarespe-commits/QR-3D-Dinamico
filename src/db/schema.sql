-- Tabla de Tenants (Multi-tenant por API Key)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(64) NOT NULL UNIQUE,
    api_key_prefix VARCHAR(16) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_rpm INT DEFAULT 120,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla principal de Items QR 3D
CREATE TABLE IF NOT EXISTS qr_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Sin título',
    target_url TEXT NOT NULL,
    rotation_strategy VARCHAR(32) DEFAULT 'one_time',
    scan_count INT DEFAULT 0,
    max_scans INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    color_primary VARCHAR(16) DEFAULT '#1e293b',
    color_secondary VARCHAR(16) DEFAULT '#ffffff',
    model_blob BYTEA,
    model_filename VARCHAR(255),
    model_format VARCHAR(16) DEFAULT 'glb',
    image_blob BYTEA,
    image_mime VARCHAR(64) DEFAULT 'image/png',
    current_qr_png BYTEA,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Logs de escaneos públicos
CREATE TABLE IF NOT EXISTS scan_logs (
    id BIGSERIAL PRIMARY KEY,
    qr_id VARCHAR(64) NOT NULL REFERENCES qr_items(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(64),
    user_agent TEXT,
    rotated BOOLEAN DEFAULT FALSE,
    target_url TEXT
);

-- Historial de rotaciones de URL / desechabilidad
CREATE TABLE IF NOT EXISTS qr_rotation_history (
    id VARCHAR(64) PRIMARY KEY,
    qr_id VARCHAR(64) NOT NULL REFERENCES qr_items(id) ON DELETE CASCADE,
    previous_url TEXT,
    new_url TEXT,
    reason VARCHAR(64) DEFAULT 'scan_exhausted',
    rotated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_qr_items_tenant ON qr_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_qr ON scan_logs(qr_id);
CREATE INDEX IF NOT EXISTS idx_tenants_key_hash ON tenants(api_key_hash);
