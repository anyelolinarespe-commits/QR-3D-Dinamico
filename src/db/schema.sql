-- Tabla de Tenants (Multi-tenant / Sitios Web por API Key)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    website_url TEXT DEFAULT '',
    api_key_hash VARCHAR(64) NOT NULL UNIQUE,
    api_key_prefix VARCHAR(16) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_rpm INT DEFAULT 120,
    default_viewer_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Usuarios con Roles (superadmin, admin, user)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(120) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255) DEFAULT '',
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
    created_by_user_id VARCHAR(64),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sesiones web / tokens de login revocables
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla principal de Items QR 3D
CREATE TABLE IF NOT EXISTS qr_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    view_token VARCHAR(64) UNIQUE,
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

-- Archivos subidos persistidos en base de datos (modelos 3D e imágenes)
CREATE TABLE IF NOT EXISTS saved_files (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    file_kind VARCHAR(16) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) DEFAULT 'application/octet-stream',
    format VARCHAR(16) DEFAULT 'glb',
    size_bytes INT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    file_blob BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migración segura para bases de datos existentes
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_viewer_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE qr_items ADD COLUMN IF NOT EXISTS view_token VARCHAR(64);
ALTER TABLE qr_items ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE saved_files ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_qr_items_tenant ON qr_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qr_items_owner ON qr_items(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_items_view_token ON qr_items(view_token);
CREATE INDEX IF NOT EXISTS idx_saved_files_tenant ON saved_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_owner ON saved_files(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_hash ON saved_files(tenant_id, sha256, file_kind);
CREATE INDEX IF NOT EXISTS idx_scan_logs_qr ON scan_logs(qr_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_qr_date ON scan_logs(qr_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_tenant_date ON scan_logs(tenant_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_tenants_key_hash ON tenants(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
