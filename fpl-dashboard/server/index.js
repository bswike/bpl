'use strict';

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

let cookieJar = null;

function createAuthenticatedClient() {
  if (!cookieJar) {
    throw new Error('No cookies set');
  }

  const client = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true,
    timeout: 15000
  }));

  client.defaults.headers.common['User-Agent'] = 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  client.defaults.headers.common['Accept'] = 'application/json';
  client.defaults.headers.common['Referer'] = 'https://fantasy.premierleague.com/';

  return client;
}

app.post('/api/set-cookies', async (req, res) => {
  const { access_token, refresh_token, global_sso_id, datadome } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: 'access_token is required' });
  }

  // Create new cookie jar
  cookieJar = new CookieJar();
  
  // Set cookies in the jar
  const baseUrl = 'https://fantasy.premierleague.com';
  
  try {
    await cookieJar.setCookie(`access_token=${access_token}; Domain=.premierleague.com; Path=/`, baseUrl);
    if (refresh_token) {
      await cookieJar.setCookie(`refresh_token=${refresh_token}; Domain=.premierleague.com; Path=/`, baseUrl);
    }
    if (global_sso_id) {
      await cookieJar.setCookie(`global_sso_id=${global_sso_id}; Domain=.premierleague.com; Path=/`, baseUrl);
    }
    if (datadome) {
      await cookieJar.setCookie(`datadome=${datadome}; Domain=.premierleague.com; Path=/`, baseUrl);
    }

    console.log('Cookies set in jar');

    // Verify
    const client = createAuthenticatedClient();
    const response = await client.get('https://fantasy.premierleague.com/api/me/');
    
    return res.json({ 
      message: 'Cookies set successfully',
      me: response.data
    });
  } catch (error) {
    console.error('Set cookies error:', error.message);
    return res.status(401).json({ 
      error: 'Failed to set or verify cookies',
      message: error.message
    });
  }
});

app.get('/api/me', async (req, res) => {
  if (!cookieJar) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const client = createAuthenticatedClient();
    const response = await client.get('https://fantasy.premierleague.com/api/me/');
    res.json(response.data);
  } catch (error) {
    res.status(401).json({ error: 'Session expired' });
  }
});

app.get('/api/my-team/:teamId', async (req, res) => {
  if (!cookieJar) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const client = createAuthenticatedClient();
    const response = await client.get(
      `https://fantasy.premierleague.com/api/my-team/${req.params.teamId}/`
    );
    res.json(response.data);
  } catch (error) {
    console.error('my-team error:', error.response?.status, error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch team',
      status: error.response?.status
    });
  }
});

app.get('/api/bootstrap-static', async (req, res) => {
  try {
    const client = axios.create();
    const response = await client.get('https://fantasy.premierleague.com/api/bootstrap-static/');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bootstrap data' });
  }
});

app.post('/api/logout', (req, res) => {
  cookieJar = null;
  res.json({ message: 'Logged out' });
});

app.get('/api/status', (req, res) => {
  res.json({ authenticated: !!cookieJar });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\nFPL Proxy Server on port ${PORT}\n`);
});
app.get('/api/my-team/:teamId', async (req, res) => {
  if (!cookieJar) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const client = createAuthenticatedClient();
    
    // Debug: check what cookies are in the jar
    const cookies = await cookieJar.getCookies('https://fantasy.premierleague.com/');
    console.log('Cookies being sent:', cookies.map(c => c.key).join(', '));
    
    const response = await client.get(
      `https://fantasy.premierleague.com/api/my-team/${req.params.teamId}/`,
      {
        validateStatus: () => true // Don't throw on any status
      }
    );
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data).substring(0, 200));
    
    if (response.status === 403) {
      return res.status(403).json({ 
        error: 'Access forbidden by FPL',
        message: 'FPL is blocking this request. This endpoint may require additional headers or direct browser access.'
      });
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('my-team error:', error.message);
    res.status(500).json({ error: 'Request failed' });
  }
});