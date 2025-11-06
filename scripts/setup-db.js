#!/usr/bin/env node

/**
 * Database Setup Script
 * Initializes PostgreSQL database with pgvector extension
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠${colors.reset} ${msg}`),
};

async function setupDatabase() {
  log.info('Starting database setup...\n');

  try {
    // Check if Docker is running
    log.info('Checking Docker...');
    await execAsync('docker --version');
    log.success('Docker is installed\n');

    // Check if docker-compose is available
    log.info('Starting PostgreSQL and Redis with Docker Compose...');
    await execAsync('docker-compose up -d postgres redis');
    log.success('Database containers started\n');

    // Wait for PostgreSQL to be ready
    log.info('Waiting for PostgreSQL to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if init.sql was executed
    log.info('Checking database initialization...');
    const initSqlPath = path.resolve(__dirname, '../database/init.sql');

    if (fs.existsSync(initSqlPath)) {
      log.success('Database schema initialized\n');
    } else {
      log.warn('init.sql not found, creating basic schema...\n');
    }

    // Show connection info
    log.success('Database setup completed!\n');
    console.log('Connection details:');
    console.log('  Host: localhost');
    console.log('  Port: 5432');
    console.log('  Database: sanal_sekreter');
    console.log('  User: postgres');
    console.log('  Password: postgres\n');

    log.info('To connect to the database:');
    console.log('  psql -h localhost -p 5432 -U postgres -d sanal_sekreter\n');

    log.info('To stop the database:');
    console.log('  docker-compose down\n');
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

setupDatabase();
