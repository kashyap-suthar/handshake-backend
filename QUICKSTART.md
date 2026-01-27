# Quick Start Guide

## Prerequisites Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] PostgreSQL >= 12.0 installed and running
- [ ] Redis >= 6.0 installed and running
- [ ] Firebase project created (optional but recommended for FCM)

## 5-Minute Setup

### 1. Install Dependencies ✅

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### 2. Set Up PostgreSQL Database

```bash
# Open PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE handshake_db;

# Verify
\l

# Exit
\q
```

### 3. Set Up Redis

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis server
# On Windows: Use Redis for Windows or WSL
# On Mac: brew services start redis
# On Linux: sudo systemctl start redis
```

### 4. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

**Minimum required for testing (without FCM):**
```env
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/handshake_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (change this!)
JWT_SECRET=my-super-secret-key-change-this
```

**Full configuration with Firebase FCM:**
```env
# Add these lines to enable push notifications
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### 5. Firebase Setup (Optional - 5 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project or select existing
3. **Project Settings** → **Service Accounts** tab
4. Click **"Generate New Private Key"**
5. Download JSON file
6. Copy these values to `.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and \n)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

### 6. Run the Server

```bash
npm run dev
```

You should see:

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🎮  Handshake Backend Server Running                  ║
║                                                          ║
║   📡  HTTP Server: http://localhost:3000                ║
║   🔌  WebSocket: ws://localhost:3000                    ║
║   📊  API Version: v1                                   ║
║   🌍  Environment: development                          ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

**Database tables will be created automatically on first run!**

## 🧪 Quick Test

### Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-01-27T02:00:00.000Z",
  "uptime": 123.45
}
```

### Test User Registration

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testplayer",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "username": "testplayer",
      "email": "test@example.com",
      ...
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the token!** You'll need it for authenticated requests.

## 🎮 Test the Handshake Flow

### Full Flow Test (2 Users)

**Step 1: Register Player A**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "playerA", "email": "playerA@test.com", "password": "pass123"}'
```

Save `TOKEN_A` and `USER_ID_A`

**Step 2: Register Player B**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "playerB", "email": "playerB@test.com", "password": "pass123"}'
```

Save `TOKEN_B` and `USER_ID_B`

**Step 3: Player A creates challenge**
```bash
curl -X POST http://localhost:3000/api/v1/challenges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_A" \
  -d '{
    "challengedId": "USER_ID_B",
    "gameType": "Chess"
  }'
```

Save `CHALLENGE_ID`

**Step 4: Player B accepts challenge**
```bash
curl -X POST http://localhost:3000/api/v1/challenges/CHALLENGE_ID/accept \
  -H "Authorization: Bearer TOKEN_B"
```

**Result:**
- Player A receives notification (check server logs)
- Challenge state: WAITING_RESPONSE
- Timeout job scheduled (30s)

**Step 5: Player A responds (simulated)**
```bash
curl -X POST http://localhost:3000/api/v1/challenges/CHALLENGE_ID/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_A" \
  -d '{"response": "ACCEPT"}'
```

**Result:**
- Session created
- Both players receive `session:ready` event
- Challenge state: ACTIVE

## 🛠️ Troubleshooting

### "Database connection error"
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check DATABASE_URL in .env
# Format: postgresql://user:password@host:port/database
```

### "Redis connection error"
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG

# If authentication error, set REDIS_PASSWORD in .env
```

### "Port 3000 already in use"
```bash
# Change PORT in .env
PORT=3001

# Or kill the process using port 3000
# Windows: netstat -ano | findstr :3000
# Then: taskkill /PID <PID> /F
```

### "Firebase error" (optional)
- Check FIREBASE_PRIVATE_KEY has `\n` line breaks
- Verify quotes around the private key value
- System works without Firebase, just no push notifications

## 📊 View Logs

Logs are saved to `./logs/` directory with daily rotation:
```
logs/
├── handshake-2026-01-27.log
├── handshake-2026-01-26.log
└── ...
```

Check real-time logs in terminal when running `npm run dev`

## 🚀 Production Deployment

Before deploying:

1. Set `NODE_ENV=production` in `.env`
2. Use strong `JWT_SECRET` (32+ characters)
3. Set specific `CORS_ORIGIN` (not *)
4. Use managed PostgreSQL (AWS RDS, etc.)
5. Use managed Redis (Redis Labs, etc.)
6. Enable HTTPS/WSS
7. Set up reverse proxy (nginx, etc.)
8. Configure process manager (PM2, etc.)

```bash
# Production start with PM2
npm install -g pm2
pm2 start src/server.js --name handshake-backend
pm2 save
pm2 startup
```

## ✅ You're Done!

Your handshake backend is now running and ready to handle player challenges!

**Next steps:**
- Build mobile app that connects to this backend
- Integrate Socket.IO client in your app
- Register FCM device tokens
- Test handshake flow with real devices

**Need help?** Check the full [README.md](README.md) for detailed documentation.
