#!/usr/bin/env node

/**
 * Seed Vector Database
 * Index sample knowledge base documents for RAG
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sanal_sekreter',
});

const sampleDocuments = [
  {
    title: 'Business Hours',
    content: 'NETZ Informatique is open Monday to Friday from 9:00 AM to 6:00 PM Paris time. We are closed on weekends and public holidays.',
    category: 'General',
    tags: ['hours', 'schedule', 'availability'],
  },
  {
    title: 'Services Overview',
    content: 'We offer comprehensive IT services including computer repair, laptop repair, data recovery, network setup, software installation, virus removal, and custom PC builds. We serve both individuals and businesses.',
    category: 'Services',
    tags: ['services', 'repair', 'it support'],
  },
  {
    title: 'Pricing Information',
    content: 'Diagnostic: Free. Basic repair: Starting from 50€. Data recovery: Starting from 100€. Network setup: Starting from 150€. Contact us for detailed quote.',
    category: 'Pricing',
    tags: ['price', 'cost', 'tarif'],
  },
  {
    title: 'Location and Contact',
    content: 'Address: Paris, France. Phone: +33 1 23 45 67 89. Email: contact@netzinformatique.fr. We offer on-site service in Paris and surrounding areas.',
    category: 'Contact',
    tags: ['address', 'location', 'contact'],
  },
  {
    title: 'Appointment Booking',
    content: 'To book an appointment, please call us during business hours or use our online booking system. We typically have same-day or next-day availability. Emergency service available for urgent issues.',
    category: 'Appointments',
    tags: ['appointment', 'booking', 'schedule'],
  },
];

async function seedDocuments() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding knowledge base documents...\n');

    for (const doc of sampleDocuments) {
      const query = `
        INSERT INTO documents (source, title, content, category, tags, access_level)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      const result = await client.query(query, [
        'manual',
        doc.title,
        doc.content,
        doc.category,
        doc.tags,
        'public',
      ]);

      if (result.rows.length > 0) {
        console.log(`✓ Inserted: ${doc.title}`);
      } else {
        console.log(`⊙ Skipped (exists): ${doc.title}`);
      }
    }

    console.log('\n✓ Seeding completed!');
    console.log('\nNext steps:');
    console.log('1. Run the RAG indexer to generate embeddings:');
    console.log('   npm run index-documents');
    console.log('\n2. Start the application:');
    console.log('   npm run dev\n');
  } catch (error) {
    console.error('✗ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDocuments();
