const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());

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

// Create short link
app.post('/api/links', async (req, res) => {
  const { target_url, short_code } = req.body;
  if (!target_url) return res.status(400).json({ error: 'Target URL is required' });

  let code = short_code || generateShortCode();
  // Check if code exists
  const existing = await pool.query('SELECT id FROM links WHERE short_code = $1', [code]);
  if (existing.rows.length > 0) {
    if (short_code) return res.status(409).json({ error: 'Short code already exists' });
    // Regenerate if auto-generated
    code = generateShortCode();
  }

  try {
    const result = await pool.query(
      'INSERT INTO links (short_code, target_url) VALUES ($1, $2) RETURNING *',
      [code, target_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM links ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get link stats
app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('SELECT * FROM links WHERE short_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete link
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('DELETE FROM links WHERE short_code = $1 RETURNING *', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json({ message: 'Link deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Redirect
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      'UPDATE links SET click_count = click_count + 1, last_clicked = NOW() WHERE short_code = $1 RETURNING target_url',
      [code]
    );
    if (result.rows.length === 0) return res.status(404).send('Link not found');
    res.redirect(302, result.rows[0].target_url);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
