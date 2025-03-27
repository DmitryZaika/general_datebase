# Welcome to Remix!

## Learnings

### Change the nginx max request size

1. Open the config: `sudo vim /etc/nginx/nginx.conf`
2. Inside the `http` object add `client_max_body_size 20M;`
3. Restart the server: `sudo systemctl restart nginx`
4. Confirm the server status: `systemctl status nginx`

### Configure https

1. Install dependencies: `sudo yum install certbot python3-certbot-nginx -y`
2. Set server_name in: `/etc/nginx/nginx.conf` below `listen [::]:80;` to `server_name granite-manager.com;`
3. Generate the certificate: `sudo certbot --nginx -d granite-manager.com`
