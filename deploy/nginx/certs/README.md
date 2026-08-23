# TLS certificates

The nginx container mounts this directory at `/etc/nginx/certs` and expects:

```
fullchain.pem   # server certificate (+ intermediates)
privkey.pem     # private key
```

## Production

Use certificates issued for your domain (Let's Encrypt, ZeroSSL, or your CA).
With certbot on the host:

```bash
sudo certbot certonly --webroot -w deploy/nginx/certs/acme -d your-domain.com
```

Then copy or symlink `fullchain.pem` / `privkey.pem` here and reload nginx.
Never commit real certificates or keys to git (`*.pem`, `*.key`, `*.crt` are
already in `.gitignore`).

## Local smoke test (self-signed)

```bash
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Browsers will show a certificate warning for self-signed certs; accept it or
trust the generated certificate locally. The HTTP listener on port 80 also
exposes `/health` unencrypted so uptime checks work before TLS is configured.
