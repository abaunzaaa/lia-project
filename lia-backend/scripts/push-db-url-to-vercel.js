const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
const text = fs.readFileSync(envPath, 'utf8');
const line = text.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
if (!line) {
  throw new Error('DATABASE_URL missing');
}

let value = line.slice('DATABASE_URL='.length).trim();
if (
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"))
) {
  value = value.slice(1, -1);
}

value = value.replace(/[?&]sslmode=[^&]*/g, '');
value = value.replace(/\?&/, '?').replace(/[?&]$/, '');

// Vercel interpola $VAR en env vars; $ en la contraseña debe ir percent-encoded.
const parsed = value.match(/^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@(.+)$/);
if (parsed) {
  const encodedPass = encodeURIComponent(decodeURIComponent(parsed[3]));
  value = `${parsed[1]}${parsed[2]}:${encodedPass}@${parsed[4]}`;
}

const afterAt = value.split('@')[1] || '';
const hostPort = afterAt.split('/')[0] || '';
console.log('db_host=' + hostPort);
console.log('has_dollar=' + String(value.includes('$')));
console.log('url_len=' + String(value.length));

const child = spawn(
  'vercel',
  [
    'env',
    'add',
    'DATABASE_URL',
    'production',
    '--yes',
    '--sensitive',
    '--force',
    '--scope',
    'tierra1',
  ],
  {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true,
    cwd: path.join(__dirname, '..'),
  }
);

child.stdin.write(value);
child.stdin.end();
child.on('exit', (code) => process.exit(code ?? 1));
