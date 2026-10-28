const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function test() {
  console.log('--- TESTING REGISTER ---');
  const regRes = await post('/api/auth/register', {
    username: 'testuser_' + Date.now(),
    email: 'test_' + Date.now() + '@example.com',
    password: 'password123'
  });
  console.log('Register Response:', regRes);

  console.log('\n--- TESTING ADMIN LOGIN ---');
  const adminRes = await post('/api/auth/login', {
    identifier: 'admin',
    password: 'Tahir@300'
  });
  console.log('Admin Login Response:', adminRes);

  console.log('\n--- TESTING USER LOGIN ---');
  const userRes = await post('/api/auth/login', {
    identifier: regRes.body?.user?.email || 'test',
    password: 'password123'
  });
  console.log('User Login Response:', userRes);
}

test().catch(console.error);
