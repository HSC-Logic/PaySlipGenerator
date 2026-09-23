# VPS Deployment

Sliply is deployed as static files to `/var/www/slipy`. GitHub Actions connects over SSH on port `10030`, clears the directory, then uploads the Vite `dist/` output.

## Prerequisites

- Ubuntu/Debian VPS with SSH access
- A deployment user with permission to write `/var/www/slipy`
- Caddy installed as a systemd service
- DNS records pointing the domain to the VPS public IP

Replace `DEPLOY_USER` with the value configured in the `VPS_DEPLOY_USER` GitHub variable.

## Create the directory

Run these commands on the VPS as a user with `sudo` access:

```bash
sudo mkdir -p /var/www/slipy
sudo chown -R DEPLOY_USER:DEPLOY_USER /var/www/slipy
sudo find /var/www/slipy -type d -exec chmod 755 {} \;
sudo find /var/www/slipy -type f -exec chmod 644 {} \;
```

The deployment user must own the directory because the workflow removes old files and uploads new files without `sudo`. Caddy only needs read and directory-traverse access. `755` directories and `644` files provide that access without making files writable by other users.

If `/var/www` has restrictive permissions, grant directory traversal without making it writable:

```bash
sudo chmod 755 /var/www
```

Do not use `chmod 777`.

## Configure DNS

Create an `A` record for `slipy.hsclogic.link` pointing to the VPS public IPv4 address. Add an `AAAA` record only if the VPS has working IPv6 configured.

When changing to `slipy.hsclogic.com`, create the equivalent DNS records before changing the Caddy site address.

## Configure Caddy

Add a dedicated local Caddy listener for Sliply. The existing Bimmal site uses port `8080`, so Sliply uses `8081`:

```caddyfile
:8081 {
    root * /var/www/slipy
    encode zstd gzip
    try_files {path} /index.html
    file_server
}
```

`try_files` serves `index.html` for client-side routes. This listener is intended for a fronting reverse proxy on the same server. Do not expose port `8081` publicly unless that is required by the server topology.

Route `slipy.hsclogic.link` to `http://127.0.0.1:8081` in the fronting proxy. The fronting proxy owns the public HTTPS certificate and ports `80` and `443`.

Validate before applying changes:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Reload Caddy without stopping the service:

```bash
sudo systemctl reload caddy
```

Use a full restart only when required by a service-level change:

```bash
sudo systemctl restart caddy
```

Check status and logs:

```bash
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 100 --no-pager
```

## Change the domain

1. Create DNS records for `slipy.hsclogic.com`.
2. Change the fronting proxy route from `slipy.hsclogic.link` to `slipy.hsclogic.com`; keep the upstream `http://127.0.0.1:8081`.
3. Run `sudo caddy validate --config /etc/caddy/Caddyfile`.
4. Run `sudo systemctl reload caddy`.
5. Add `https://slipy.hsclogic.com` to Google OAuth authorized JavaScript origins.
6. Remove the old origin after the old domain is no longer used.

## GitHub Actions configuration

Add these under **Settings → Secrets and variables → Actions**:

- Secret: `VPS_DEPLOY_SSH_KEY`, containing the private SSH key for the deployment user
- Variable: `VPS_DEPLOY_HOST`, containing the VPS hostname or IP address
- Variable: `VPS_DEPLOY_USER`, containing the deployment username
- Variable: `VITE_GOOGLE_CLIENT_ID`, containing the public Google OAuth client ID if Google integration is enabled

The workflow runs on pushes to `main` and can also be started manually from **Actions → Deploy Sliply Web → Run workflow**.
