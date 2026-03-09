/**
 * certGen.js
 *
 * Auto-generates a local CA + signed server cert using node-forge.
 * Replaces the need for mkcert or any external certificate tooling.
 *
 * On first run: creates certs/rootCA.pem, certs/server.pem, certs/server-key.pem
 * Phones: visit https://<lan-ip>:3000/rootCA.pem and install the CA to trust HTTPS.
 * Host browser: accept the cert warning once, or import rootCA.pem into Windows cert store.
 */

import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CA_VALID_YEARS   = 10;
const CERT_VALID_YEARS = 2;

/**
 * Returns all non-loopback IPv4 addresses on this machine.
 */
function getLanIPs() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const addr of ifaces) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

/**
 * Generates a self-signed root CA keypair + certificate.
 */
function generateCA() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter  = new Date(now);
  cert.validity.notAfter.setFullYear(now.getFullYear() + CA_VALID_YEARS);

  const attrs = [
    { name: 'commonName',         value: 'Gore Karaoke Local CA' },
    { name: 'organizationName',   value: 'Gore Karaoke'          },
    { name: 'organizationalUnitName', value: 'Party Infrastructure'     },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return { cert, keys };
}

/**
 * Generates a server cert signed by the given CA, covering localhost + all LAN IPs.
 */
function generateServerCert(caKeys, caCert, lanIPs) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '02';

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter  = new Date(now);
  cert.validity.notAfter.setFullYear(now.getFullYear() + CERT_VALID_YEARS);

  cert.setSubject([{ name: 'commonName', value: 'Gore Karaoke' }]);
  cert.setIssuer(caCert.subject.attributes);

  const altNames = [
    { type: 2 /* DNS */, value: 'localhost' },
    { type: 7 /* IP  */, ip:    '127.0.0.1' },
    ...lanIPs.map(ip => ({ type: 7, ip })),
  ];

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes() },
  ]);
  cert.sign(caKeys.privateKey, forge.md.sha256.create());

  return { cert, keys };
}

// Renew the server cert this many days before it expires.
const RENEW_BEFORE_DAYS = 30;

/**
 * Returns the set of IP SAN strings baked into an existing cert.
 */
function getCertIPs(cert) {
  const ips = new Set();
  try {
    const san = cert.getExtension('subjectAltName');
    if (san && san.altNames) {
      for (const entry of san.altNames) {
        if (entry.type === 7 /* IP */) ips.add(entry.ip);
      }
    }
  } catch { /* ignore parse errors */ }
  return ips;
}

/**
 * Checks whether the existing server cert is still valid to use:
 *   - All three PEM files must exist.
 *   - The cert must not be expired or within RENEW_BEFORE_DAYS of expiry.
 *   - Every current LAN IP must appear in the cert's SAN list.
 *
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function checkExistingCert(certPath, keyPath, caCertPath, lanIPs) {
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(caCertPath)) {
    return { valid: false, reason: 'missing cert files' };
  }

  let cert;
  try {
    cert = forge.pki.certificateFromPem(fs.readFileSync(certPath, 'utf8'));
  } catch {
    return { valid: false, reason: 'cert file is corrupt or unreadable' };
  }

  // Expiry check
  const now         = new Date();
  const renewAfter  = new Date(cert.validity.notAfter);
  renewAfter.setDate(renewAfter.getDate() - RENEW_BEFORE_DAYS);
  if (now >= renewAfter) {
    const expired = now >= cert.validity.notAfter;
    return {
      valid: false,
      reason: expired
        ? `cert expired on ${cert.validity.notAfter.toDateString()}`
        : `cert expires soon (${cert.validity.notAfter.toDateString()}) — renewing early`,
    };
  }

  // IP coverage check — if the machine's LAN IP changed (DHCP / new network)
  // the old cert won't cover the new address and phones will get a TLS error.
  const certIPs = getCertIPs(cert);
  const missing  = lanIPs.filter(ip => !certIPs.has(ip));
  if (missing.length > 0) {
    return { valid: false, reason: `LAN IP(s) not covered by cert: ${missing.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Ensures HTTPS certs exist on disk and are still valid.
 *
 * Automatically regenerates when:
 *   - Any cert file is missing or corrupt
 *   - The server cert has expired or is within 30 days of expiry
 *   - The machine's LAN IP has changed since the cert was issued
 *     (e.g. DHCP lease renewal or moved to a different network)
 *
 * @param {string} certPath    - Path to save server cert PEM
 * @param {string} keyPath     - Path to save server private key PEM
 * @param {string} caCertPath  - Path to save root CA cert PEM (served to phones)
 */
export function ensureCerts(certPath, keyPath, caCertPath) {
  const lanIPs = getLanIPs();
  const check  = checkExistingCert(certPath, keyPath, caCertPath, lanIPs);

  if (check.valid) {
    return; // Certs are present and still good
  }

  console.log(`🔐 Cert check: ${check.reason}`);

  const hosts = ['localhost', '127.0.0.1', ...lanIPs];
  console.log('🔐 Generating self-signed CA + server cert...');
  console.log(`   Covering: ${hosts.join(', ')}`);

  // Key generation takes a couple of seconds — expected at first boot / renewal
  const { cert: caCert, keys: caKeys } = generateCA();
  const { cert: serverCert, keys: serverKeys } = generateServerCert(caKeys, caCert, lanIPs);

  fs.mkdirSync(path.dirname(certPath),   { recursive: true });
  fs.mkdirSync(path.dirname(caCertPath), { recursive: true });

  fs.writeFileSync(certPath,   forge.pki.certificateToPem(serverCert));
  fs.writeFileSync(keyPath,    forge.pki.privateKeyToPem(serverKeys.privateKey));
  fs.writeFileSync(caCertPath, forge.pki.certificateToPem(caCert));

  console.log('✅ Certs generated and saved to certs/');
  console.log('');
  console.log('📲 To trust HTTPS on phones (re-install if you just regenerated):');
  for (const ip of lanIPs) {
    console.log(`   https://${ip}:${process.env.PORT || 3000}/rootCA.pem  →  install on device`);
  }
  console.log('');
  console.log('🖥️  Host browser: accept the cert warning once, or import certs/rootCA.pem');
  console.log('   into Windows: certmgr.msc → Trusted Root Certification Authorities → Import');
  console.log('');
}
