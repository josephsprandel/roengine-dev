-- Authentication & Role-Based Access Control System
-- Migration 011: Users, Roles, Permissions

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Roles table (admin-configurable)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false, -- System roles can't be deleted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Permissions table (predefined system permissions)
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'delete_ro', 'view_pricing'
  name VARCHAR(255) NOT NULL, -- Human-readable: "Delete Repair Orders"
  description TEXT,
  category VARCHAR(50) NOT NULL -- Group: repair_orders, customers, settings, etc.
);

-- Role-Permission mapping (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User-Role mapping (many-to-many - users can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by INTEGER REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(key);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- Seed permissions
INSERT INTO permissions (key, name, description, category) VALUES
  -- Repair Orders
  ('view_ro', 'View Repair Orders', 'Can view repair orders', 'repair_orders'),
  ('create_ro', 'Create Repair Orders', 'Can create new repair orders', 'repair_orders'),
  ('edit_ro', 'Edit Repair Orders', 'Can edit existing repair orders', 'repair_orders'),
  ('delete_ro', 'Delete Repair Orders', 'Can soft delete repair orders', 'repair_orders'),
  ('restore_ro', 'Restore Repair Orders', 'Can restore deleted repair orders', 'repair_orders'),
  ('permanent_delete_ro', 'Permanently Delete ROs', 'Can permanently delete (admin only)', 'repair_orders'),
  ('view_ro_pricing', 'View RO Pricing', 'Can see costs and pricing on ROs', 'repair_orders'),
  
  -- Customers
  ('view_customers', 'View Customers', 'Can view customer list and details', 'customers'),
  ('create_customer', 'Create Customers', 'Can create new customers', 'customers'),
  ('edit_customer', 'Edit Customers', 'Can edit customer information', 'customers'),
  ('delete_customer', 'Delete Customers', 'Can soft delete customers', 'customers'),
  ('restore_customer', 'Restore Customers', 'Can restore deleted customers', 'customers'),
  
  -- Vehicles
  ('view_vehicles', 'View Vehicles', 'Can view vehicle information', 'vehicles'),
  ('create_vehicle', 'Create Vehicles', 'Can add new vehicles', 'vehicles'),
  ('edit_vehicle', 'Edit Vehicles', 'Can edit vehicle information', 'vehicles'),
  ('delete_vehicle', 'Delete Vehicles', 'Can soft delete vehicles', 'vehicles'),
  ('restore_vehicle', 'Restore Vehicles', 'Can restore deleted vehicles', 'vehicles'),
  
  -- Inventory
  ('view_inventory', 'View Inventory', 'Can view parts inventory', 'inventory'),
  ('edit_inventory', 'Edit Inventory', 'Can edit inventory quantities and details', 'inventory'),
  ('import_inventory', 'Import Inventory', 'Can import inventory from CSV', 'inventory'),
  
  -- Settings
  ('view_settings', 'View Settings', 'Can view shop settings', 'settings'),
  ('edit_settings', 'Edit Settings', 'Can modify shop settings', 'settings'),
  ('manage_users', 'Manage Users', 'Can create/edit/delete users', 'settings'),
  ('manage_roles', 'Manage Roles', 'Can create/edit roles and assign permissions', 'settings'),
  
  -- Reports
  ('view_reports', 'View Reports', 'Can view shop reports and analytics', 'reports'),
  ('export_reports', 'Export Reports', 'Can export reports to CSV/PDF', 'reports')
ON CONFLICT (key) DO NOTHING;

-- Seed default roles
INSERT INTO roles (name, description, is_system_role) VALUES
  ('Owner', 'Full system access - all permissions', true),
  ('Manager', 'Shop management - most permissions except user management', true),
  ('Advisor', 'Service advisor - customer and RO management', true),
  ('Technician', 'Technician - view and update assigned work', true)
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to Owner role (role_id = 1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.name = 'Owner'
ON CONFLICT DO NOTHING;

-- Assign permissions to Manager (all except manage_users and permanent_delete_ro)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Manager' 
  AND p.key NOT IN ('manage_users', 'permanent_delete_ro')
ON CONFLICT DO NOTHING;

-- Assign permissions to Advisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Advisor' 
  AND p.category IN ('repair_orders', 'customers', 'vehicles') 
  AND p.key NOT IN ('permanent_delete_ro', 'restore_ro', 'restore_customer', 'restore_vehicle')
ON CONFLICT DO NOTHING;

-- Assign permissions to Technician
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Technician' 
  AND p.key IN ('view_ro', 'edit_ro', 'view_vehicles', 'view_inventory')
ON CONFLICT DO NOTHING;

-- Create initial admin user (password: "admin123")
-- Hash generated using bcrypt with 10 salt rounds
INSERT INTO users (email, password_hash, name, is_active) VALUES
  ('admin@autohouse.com', '$2b$10$ZV3VIArnR2h1CV.wmC2HBOfbkwjoJeS4AW8ZvD0g2I3NrShC6nD7a', 'Admin User', true)
ON CONFLICT (email) DO NOTHING;

-- Assign Owner role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM users u, roles r
WHERE u.email = 'admin@autohouse.com' AND r.name = 'Owner'
ON CONFLICT DO NOTHING;
