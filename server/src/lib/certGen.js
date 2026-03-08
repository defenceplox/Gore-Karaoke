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

/**
 * Ensures HTTPS certs exist on disk.
 * If any cert file is missing, regenerates the full CA + server cert from scratch.
 *
 * @param {string} certPath    - Path to save server cert PEM
 * @param {string} keyPath     - Path to save server private key PEM
 * @param {string} caCertPath  - Path to save root CA cert PEM (served to phones)
 */
export function ensureCerts(certPath, keyPath, caCertPath) {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(caCertPath)) {
    return; // All certs already present
  }

  const lanIPs = getLanIPs();
  const hosts  = ['localhost', '127.0.0.1', ...lanIPs];

  console.log('🔐 Generating self-signed CA + server cert...');
  console.log(`   Covering: ${hosts.join(', ')}`);

  // Key generation takes a couple of seconds — expected at first boot
  const { cert: caCert, keys: caKeys } = generateCA();
  const { cert: serverCert, keys: serverKeys } = generateServerCert(caKeys, caCert, lanIPs);

  fs.mkdirSync(path.dirname(certPath),   { recursive: true });
  fs.mkdirSync(path.dirname(caCertPath), { recursive: true });

  fs.writeFileSync(certPath,   forge.pki.certificateToPem(serverCert));
  fs.writeFileSync(keyPath,    forge.pki.privateKeyToPem(serverKeys.privateKey));
  fs.writeFileSync(caCertPath, forge.pki.certificateToPem(caCert));

  console.log('✅ Certs generated and saved to certs/');
  console.log('');
  console.log('📲 To trust HTTPS on phones:');
  for (const ip of lanIPs) {
    console.log(`   https://${ip}:${process.env.PORT || 3000}/rootCA.pem  →  install on device`);
  }
  console.log('');
  console.log('🖥️  Host browser: accept the cert warning once, or import certs/rootCA.pem');
  console.log('   into Windows: certmgr.msc → Trusted Root Certification Authorities → Import');
  console.log('');
}
