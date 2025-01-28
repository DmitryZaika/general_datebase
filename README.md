# Welcome to Remix!

## Learnings

### Change the nginx max request size

1. Open the config: `sudo vim /etc/nginx/nginx.conf`
2. Inside the `http` object add `client_max_body_size 20M;`
3. Restart the server: `sudo systemctl restart nginx`
4. Confirm the server status: `systemctl status nginx`
