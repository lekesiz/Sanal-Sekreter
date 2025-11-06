-- NETZ Sanal Sekreter - Database Schema
-- PostgreSQL with pgvector extension

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_sid VARCHAR(255) UNIQUE NOT NULL,
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
    status VARCHAR(50) NOT NULL, -- 'queued', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer'
    start_time TIMESTAMP NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP,
    duration INTEGER, -- in seconds
    recording_url TEXT,
    recording_duration INTEGER,
    price DECIMAL(10, 4),
    price_unit VARCHAR(10),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    speaker VARCHAR(50) NOT NULL, -- 'caller', 'agent', 'system'
    text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL,
    confidence DECIMAL(5, 4),
    timestamp_offset INTEGER, -- milliseconds from call start
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Intents table
CREATE TABLE IF NOT EXISTS intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    intent_name VARCHAR(100) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    slots JSONB DEFAULT '{}',
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Documents table (for RAG system)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(100) NOT NULL, -- 'drive', 'manual', 'website'
    source_id VARCHAR(255), -- External ID (e.g., Google Drive file ID)
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    department VARCHAR(100),
    category VARCHAR(100),
    tags TEXT[],
    access_level VARCHAR(50) DEFAULT 'public', -- 'public', 'internal', 'confidential'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_indexed_at TIMESTAMP
);

-- Document chunks table (for RAG)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agents table (human agents for handoff)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    department VARCHAR(100),
    role VARCHAR(100),
    skills TEXT[],
    status VARCHAR(50) DEFAULT 'offline', -- 'online', 'offline', 'busy', 'away'
    max_concurrent_calls INTEGER DEFAULT 3,
    current_calls INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Call handoffs table
CREATE TABLE IF NOT EXISTS call_handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    reason TEXT,
    context JSONB DEFAULT '{}', -- Summary, intent, key points
    status VARCHAR(50) NOT NULL, -- 'pending', 'accepted', 'rejected', 'completed'
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- RAG queries log
CREATE TABLE IF NOT EXISTS rag_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results JSONB DEFAULT '[]',
    top_score DECIMAL(5, 4),
    used_in_response BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- System audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10, 4) NOT NULL,
    metric_unit VARCHAR(50),
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_calls_from_number ON calls(from_number);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_start_time ON calls(start_time DESC);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);

CREATE INDEX idx_transcripts_call_id ON transcripts(call_id);
CREATE INDEX idx_transcripts_speaker ON transcripts(speaker);

CREATE INDEX idx_intents_call_id ON intents(call_id);
CREATE INDEX idx_intents_name ON intents(intent_name);

CREATE INDEX idx_documents_source ON documents(source);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_access_level ON documents(access_level);
CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
-- Vector similarity search index (IVFFlat for better performance)
CREATE INDEX idx_document_chunks_embedding ON document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_department ON agents(department);

CREATE INDEX idx_call_handoffs_call_id ON call_handoffs(call_id);
CREATE INDEX idx_call_handoffs_agent_id ON call_handoffs(agent_id);
CREATE INDEX idx_call_handoffs_status ON call_handoffs(status);

CREATE INDEX idx_rag_queries_call_id ON rag_queries(call_id);
CREATE INDEX idx_rag_queries_created_at ON rag_queries(created_at DESC);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX idx_metrics_metric_name ON metrics(metric_name);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample agent data
INSERT INTO agents (name, email, phone_number, department, role, skills, status) VALUES
('Mikail Lekesiz', 'mikail@netz-informatique.fr', '+33123456789', 'Technical Support', 'Senior Technician', ARRAY['Hardware Repair', 'Software Support', 'Network Setup'], 'online'),
('Support Agent 1', 'support1@netz-informatique.fr', '+33123456790', 'Customer Support', 'Support Specialist', ARRAY['Customer Service', 'Billing', 'General Inquiries'], 'online'),
('Support Agent 2', 'support2@netz-informatique.fr', '+33123456791', 'Technical Support', 'Technician', ARRAY['Diagnostics', 'Maintenance'], 'offline')
ON CONFLICT (email) DO NOTHING;

-- Insert sample knowledge base documents
INSERT INTO documents (source, title, content, category, tags, access_level) VALUES
('manual', 'Business Hours', 'NETZ Informatique is open Monday to Friday, 9:00 AM to 6:00 PM (Paris time). We are closed on weekends and public holidays.', 'General', ARRAY['hours', 'schedule'], 'public'),
('manual', 'Services Overview', 'NETZ Informatique offers: Computer repair, IT consulting, Network setup, Data recovery, Software installation, and Custom PC builds. We serve both individuals and businesses.', 'Services', ARRAY['services', 'offerings'], 'public'),
('manual', 'Contact Information', 'Address: [Your Address]. Phone: +33 1 23 45 67 89. Email: contact@netz-informatique.fr. For urgent technical support, please call during business hours.', 'Contact', ARRAY['contact', 'address'], 'public')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE calls IS 'Stores all phone call records';
COMMENT ON TABLE transcripts IS 'Stores speech-to-text transcripts of calls';
COMMENT ON TABLE intents IS 'Stores detected intents from conversations';
COMMENT ON TABLE documents IS 'Stores knowledge base documents for RAG';
COMMENT ON TABLE document_chunks IS 'Stores chunked documents with embeddings for vector search';
COMMENT ON TABLE agents IS 'Stores human agent information for call handoffs';
COMMENT ON TABLE call_handoffs IS 'Tracks call transfers to human agents';
COMMENT ON TABLE rag_queries IS 'Logs all RAG system queries for analytics';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail';
COMMENT ON TABLE metrics IS 'Performance and business metrics';
