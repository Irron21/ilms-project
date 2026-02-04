# ILMS Project - Production Setup

This repository contains a production-ready setup for the ILMS project using Docker, Nginx, Redis, and MySQL.

## 1. Prerequisites
- **Docker** & **Docker Compose** installed on the server.
- A Linux Server (Ubuntu 20.04/22.04 recommended).
- Domain Name (pointed to server IP).

## 2. Infrastructure Overview
- **Client**: React App served via Nginx (Port 80 internally).
- **Server**: Node.js API (Port 4000 internally).
- **Database**: MySQL 8.0.
- **Cache**: Redis (Caching API responses).
- **Load Balancer**: Nginx Reverse Proxy (Exposed Ports 80, 443).

## 3. Deployment

### Deployment (Manual)
1. Copy the project to your server.
2. Create a `.env` file in the root directory (use `.env.example` as a template).
3. Run the following command to build and start the services:
   ```bash
   docker-compose up -d --build
   ```

## 4. Security Hardening
A script is provided to set up the Firewall (UFW) and harden OpenSSH configurations.

**Run on Server:**
```bash
chmod +x scripts/setup_security.sh
sudo ./scripts/setup_security.sh
```
*Note: This will disable root login and password authentication for SSH. Ensure you have SSH key access working!*

## 5. SSL/TLS Configuration (HTTPS)
The Nginx proxy is configured in `nginx-proxy/conf.d/default.conf`.

To enable HTTPS:
1. Obtain an SSL certificate (e.g., using Certbot).
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```
2. Update `nginx-proxy/conf.d/default.conf`:
   - Uncomment the HTTPS `server` block.
   - Update `server_name` to your domain.
3. Update `docker-compose.yml`:
   - Mount the certificate files into the `nginx-proxy` container.
   ```yaml
   volumes:
     - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/ssl/fullchain.pem
     - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/ssl/privkey.pem
   ```
4. Restart containers:
   ```bash
   docker-compose restart nginx-proxy
   ```

## 6. Caching Strategy
**Redis** is integrated for caching.
- **Middleware**: `server/middleware/cacheMiddleware.js` handles caching logic.
- **Configuration**: Applied to read-heavy routes (e.g., `/api/kpi`) in `server/server.js`.
- **Default TTL**: 5 minutes (300 seconds).
