const https = require('https');

// Firebase Admin via REST API (sem SDK para funcionar no Vercel gratuito)
const FIREBASE_API_KEY = "AIzaSyCqb1gQwuMQLjoj1UAj37zBO3vOT_t3C2s";

async function createFirebaseUser(email) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: email,
      password: Math.random().toString(36).slice(-12) + "A1!",
      returnSecureToken: false
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve({ error: { message: body } });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendPasswordReset(email) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email: email
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    console.log('Webhook recebido:', JSON.stringify(body));

    // Kiwify envia o e-mail do comprador em diferentes campos
    const email = 
      body?.Customer?.email ||
      body?.customer?.email ||
      body?.data?.customer?.email ||
      body?.email;

    const status = 
      body?.order_status ||
      body?.status ||
      body?.data?.status;

    // Só processa compras aprovadas
    if (!email) {
      console.log('E-mail não encontrado no webhook');
      return res.status(200).json({ ok: true, msg: 'Email not found, ignored' });
    }

    if (status && !['paid', 'approved', 'complete', 'completed'].includes(status.toLowerCase())) {
      console.log('Status não é aprovado:', status);
      return res.status(200).json({ ok: true, msg: 'Not approved, ignored' });
    }

    console.log('Cadastrando aluna:', email);

    // Cria usuário no Firebase
    const createResult = await createFirebaseUser(email);

    if (createResult.error) {
      const errorMsg = createResult.error.message || '';
      
      if (errorMsg.includes('EMAIL_EXISTS')) {
        // Aluna já existe — só manda reset de senha
        console.log('Aluna já existe, enviando reset de senha');
        await sendPasswordReset(email);
        return res.status(200).json({ ok: true, msg: 'User exists, reset sent' });
      }
      
      console.error('Erro ao criar usuário:', createResult.error);
      return res.status(500).json({ error: createResult.error });
    }

    // Usuário criado — envia e-mail para criar senha
    await sendPasswordReset(email);
    console.log('Aluna cadastrada e e-mail enviado:', email);

    return res.status(200).json({ ok: true, email, msg: 'User created and email sent' });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return res.status(500).json({ error: error.message });
  }
};
