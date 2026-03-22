module.exports = async (req, res) => {
  const https = require('https');
  const FIREBASE_API_KEY = "AIzaSyCqb1gQwuMQLjoj1UAj37zBO3vOT_t3C2s";
  const KIWIFY_TOKEN = "nyxjc75y6zy";

  if (req.method !== 'POST') return res.status(405).end();

  const token = req.query.token || req.headers['x-kiwify-token'];
  if (token !== KIWIFY_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const b = req.body || {};
  
  // Log completo para debug
  console.log('BODY COMPLETO:', JSON.stringify(b));
  console.log('KEYS:', Object.keys(b));

  const email = 
    (b.Customer && b.Customer.email) || 
    (b.customer && b.customer.email) || 
    (b.data && b.data.customer && b.data.customer.email) ||
    b.email ||
    b.buyer_email ||
    b.payer_email;

  console.log('EMAIL ENCONTRADO:', email);

  if (!email) return res.status(200).json({ ok: true, msg: 'no email found', body: b });

  function post(path, data) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(data);
      const req2 = https.request({
        hostname: 'identitytoolkit.googleapis.com',
        path: path + '?key=' + FIREBASE_API_KEY,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });
  }

  const status = b.order_status || b.status || '';
  if (status && !['paid','approved','complete','completed'].includes(status.toLowerCase()))
    return res.status(200).json({ ok: true, msg: 'not approved: ' + status });

  const created = await post('/v1/accounts:signUp',
    { email, password: Math.random().toString(36).slice(-10)+'A1!', returnSecureToken: false });

  if (created.error) {
    if ((created.error.message||'').includes('EMAIL_EXISTS')) {
      await post('/v1/accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email });
      return res.status(200).json({ ok: true, msg: 'reset sent to ' + email });
    }
    return res.status(500).json({ error: created.error });
  }

  await post('/v1/accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email });
  return res.status(200).json({ ok: true, email, msg: 'created and email sent' });
};
