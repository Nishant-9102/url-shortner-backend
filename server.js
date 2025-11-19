const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const { pool } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Initialize database
const sql = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
console.log('Initializing database with SQL:', sql);
pool.query(sql, (err) => {
  if (err) {
    console.error('Error initializing database:', err.message);
    console.error('Error details:', err);
  } else {
    console.log('Database initialized.');
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Helper function to generate random short code
function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// API Routes

// Shorten URL
app.post('/shorten', async (req, res) => {
  const { original_url, custom_code } = req.body;
  if (!original_url) return res.status(400).json({ error: 'Original URL is required' });

  try {
    let code = custom_code || generateShortCode();
    // Check if code exists
    const existing = await pool.query('SELECT id FROM links WHERE short_code = $1', [code]);
    if (existing.rows.length > 0) {
      if (custom_code) {
        return res.status(400).json({ error: 'Custom code already exists' });
      }
      code = generateShortCode(); // Regenerate if collision
    }
    const result = await pool.query('INSERT INTO links (original_url, short_code) VALUES ($1, $2) RETURNING id', [original_url, code]);
    res.status(201).json({ id: result.rows[0].id, short_code: code, original_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT 
    id,
    original_url,
    short_code,
    created_at AT TIME ZONE 'Asia/Kolkata' AS created_at,
    click_count,
    last_clicked AT TIME ZONE 'Asia/Kolkata' AS last_clicked
  FROM links
  ORDER BY id DESC
`);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get link by code
app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('SELECT * FROM links WHERE short_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete link
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('DELETE FROM links WHERE short_code = $1', [code]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Link not found' });
    res.json({ message: 'Link deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Redirect
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('SELECT original_url FROM links WHERE short_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    await pool.query(
  `UPDATE links 
   SET click_count = click_count + 1, 
       last_clicked = CURRENT_TIMESTAMP 
   WHERE short_code = $1`,
  [code]
);

    res.redirect(302, result.rows[0].original_url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
