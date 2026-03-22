const https = require('https');

const FIREBASE_API_KEY = "AIzaSyCqb1gQwuMQLjoj1UAj37zBO3vOT_t3C2s";
const KIWIFY_TOKEN = "nyxjc75y6zy";

function post(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let r = '';
      res.on('data', c => r += c);
      res.on('end', () => { try { resolve(JSON.parse(r)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.query.token || req.headers['x-kiwify-token'];
  if (token !== KIWIFY_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const b = req.body || {};
  const email = b.Customer?.email || b.customer?.email || b.email;
  const status = b.order_status || b.status || '';

  if (!email) return res.status(200).json({ ok: true, msg: 'no email' });
  if (status && !['paid','approved','complete','completed'].includes(status.toLowerCase()))
    return res.status(200).json({ ok: true, msg: 'not approved' });

  const key = FIREBASE_API_KEY;
  const created = await post('identitytoolkit.googleapis.com',
    `/v1/accounts:signUp?key=${key}`,
    { email, password: Math.random().toString(36).slice(-10)+'A1!', returnSecureToken: false }
  );

  if (created.error) {
    if ((created.error.message||'').includes('EMAIL_EXISTS')) {
      await post('identitytoolkit.googleapis.com', `/v1/accounts:sendOobCode?key=${key}`,
        { requestType: 'PASSWORD_RESET', email });
      return res.status(200).json({ ok: true, msg: 'reset sent' });
    }
    return res.status(500).json({ error: created.error });
  }

  await post('identitytoolkit.googleapis.com', `/v1/accounts:sendOobCode?key=${key}`,
    { requestType: 'PASSWORD_RESET', email });

  return res.status(200).json({ ok: true, email, msg: 'created and email sent' });
};
