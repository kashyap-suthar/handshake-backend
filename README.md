# Handshake Backend

Production-ready Node.js backend for asynchronous-to-synchronous player handshake system for peer-to-peer gaming applications. Provides real-time notifications via WebSocket and Firebase Cloud Messaging (FCM) to wake up players even when the app is killed or in the background.

## 🚀 Features

- **Real-time WebSocket communication** with Socket.IO and Redis adapter for horizontal scaling
- **High-priority push notifications** via Firebase Cloud Messaging (iOS critical alerts + Android full-screen intents)
- **Multi-device support** - Track users across multiple devices simultaneously
- **Distributed architecture** - Redis-based distributed locks and pub/sub
- **Retry mechanism** - 3 attempts with 30-second intervals for handshake timeouts
- **PostgreSQL database** with Sequelize ORM for robust data persistence
- **Bull job queue** for background processing and timeout handling
- **JWT authentication** for secure API access
- **Rate limiting** with Redis for DDoS protection
- **Comprehensive logging** with Winston

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 12.0
- **Redis** >= 6.0
- **Firebase Project** with Cloud Messaging enabled

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd handshake-backend
npm install
```

### 2. Set Up PostgreSQL Database

```bash
# Create database
psql -U postgres
CREATE DATABASE handshake_db;
\q
```

### 3. Set Up Redis

Install Redis locally or use a cloud service like Redis Labs or AWS ElastiCache.

```bash
# Start Redis (if installed locally)
redis-server
```

### 4. Configure Firebase Cloud Messaging

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Navigate to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file (keep it secure, never commit to Git)
6. Extract these values for your `.env` file:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

### 5. Create Environment File

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/handshake_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-key-change-this

# Firebase (from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Key Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3000` with auto-reload via nodemon.

### Production Mode

```bash
npm start
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

## 📡 API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/profile` | Get user profile | Yes |

### Challenges

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/challenges` | Create challenge | Yes |
| GET | `/challenges/me/pending` | Get pending challenges | Yes |
| GET | `/challenges/:id` | Get challenge details | Yes |
| POST | `/challenges/:id/accept` | Accept challenge (triggers handshake) | Yes |
| POST | `/challenges/:id/respond` | Respond to wake-up (ACCEPT/DECLINE) | Yes |

### Presence & Notifications

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/presence/register-device` | Register FCM token | Yes |
| POST | `/presence/unregister-device` | Unregister FCM token | Yes |
| POST | `/presence/heartbeat` | Keep-alive | Yes |
| GET | `/presence/:userId` | Get user presence | Yes |

### Sessions

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/sessions/me/active` | Get active sessions | Yes |
| GET | `/sessions/:id` | Get session details | Yes |
| POST | `/sessions/:id/end` | End session | Yes |

## 🔌 WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `heartbeat` | `{}` | Keep presence alive |
| `challenge:respond` | `{ challengeId, response }` | Respond to wake-up (ACCEPT/DECLINE) |
| `session:join` | `{ sessionId }` | Join session room |
| `session:leave` | `{ sessionId }` | Leave session room |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ userId, username, timestamp }` | Connection successful |
| `challenge:wake-up` | `{ challengeId, challenger, gameType }` | Wake-up notification |
| `challenge:declined` | `{ challengeId, timestamp }` | Challenge declined |
| `challenge:timeout` | `{ challengeId, timestamp }` | Challenge timed out |
| `session:ready` | `{ sessionId, challengeId, opponent }` | Session created |
| `heartbeat-ack` | `{ timestamp }` | Heartbeat acknowledged |

## 🔄 Handshake Flow

### Complete Flow (Player B accepts challenge)

```
1. Player B → POST /api/v1/challenges/:id/accept
2. Backend:
   ├─ Acquire distributed lock
   ├─ Validate challenge state (PENDING)
   ├─ Update state to NOTIFYING
   ├─ Check Player A online status (Redis)
   ├─ IF online: Emit WebSocket 'challenge:wake-up' to all devices
   ├─ ALWAYS: Send FCM high-priority push notification
   ├─ Update state to WAITING_RESPONSE
   └─ Schedule timeout job (30s delay)
3. Player A receives notification (WebSocket or FCM)
4. Player A → Socket emit 'challenge:respond' { response: 'ACCEPT' }
   OR Player A → POST /api/v1/challenges/:id/respond { response: 'ACCEPT' }
5. Backend:
   ├─ Create Session
   ├─ Update challenge to ACTIVE
   └─ Emit 'session:ready' to both players
6. Both players join game session

### Timeout/Retry Flow

If Player A doesn't respond within 30 seconds:
- Attempt 1: Resend notification, wait 30s
- Attempt 2: Resend notification, wait 30s
- Attempt 3: Resend notification, wait 30s
- After 3 attempts: Mark challenge as TIMEOUT, notify Player B
```

## 🧪 Manual Testing

### 1. Register Users

```bash
# Player A
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "playerA",
    "email": "playerA@test.com",
    "password": "password123"
  }'

# Save the token from response

# Player B
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "playerB",
    "email": "playerB@test.com",
    "password": "password123"
  }'
```

### 2. Create Challenge (Player A)

```bash
curl -X POST http://localhost:3000/api/v1/challenges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PLAYER_A_TOKEN" \
  -d '{
    "challengedId": "PLAYER_B_USER_ID",
    "gameType": "Chess"
  }'
```

### 3. Accept Challenge (Player B)

```bash
curl -X POST http://localhost:3000/api/v1/challenges/CHALLENGE_ID/accept \
  -H "Authorization: Bearer YOUR_PLAYER_B_TOKEN"
```

### 4. Connect with WebSocket (Player A)

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  auth: {
    token: 'YOUR_PLAYER_A_TOKEN'
  }
});

socket.on('challenge:wake-up', (data) => {
  console.log('Wake-up received:', data);
  
  // Respond
  socket.emit('challenge:respond', {
    challengeId: data.challengeId,
    response: 'ACCEPT'
  });
});

socket.on('session:ready', (data) => {
  console.log('Session ready:', data);
});
```

## 📊 Database Schema

### Users Table
- `id` (UUID, PK)
- `username` (String, Unique)
- `email` (String, Unique)
- `password` (String, Hashed)
- `device_tokens` (Array of FCM tokens)
- `is_active` (Boolean)
- `created_at`, `updated_at`

### Challenges Table
- `id` (UUID, PK)
- `challenger_id` (UUID, FK → users)
- `challenged_id` (UUID, FK → users)
- `state` (Enum: PENDING, NOTIFYING, WAITING_RESPONSE, ACTIVE, DECLINED, TIMEOUT, EXPIRED)
- `game_type` (String)
- `expires_at` (DateTime)
- `notification_attempts` (Integer)
- `last_notification_at` (DateTime)
- `metadata` (JSONB)
- `created_at`, `updated_at`

### Sessions Table
- `id` (UUID, PK)
- `challenge_id` (UUID, FK → challenges)
- `players` (Array of 2 UUIDs)
- `state` (Enum: ACTIVE, COMPLETED, ABANDONED)
- `started_at` (DateTime)
- `ended_at` (DateTime)
- `metadata` (JSONB)
- `created_at`, `updated_at`

## 🔧 Redis Cache Structure

```
presence:{userId}              → Hash { isOnline, lastSeen, connectionCount }
user_socket:{userId}           → Set of socketIds (multi-device)
socket:{socketId}              → String (userId)
lock:challenge:{challengeId}   → Distributed lock (10s TTL)
```

## 🚀 Deployment

### Environment Variables for Production

- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Enable HTTPS/WSS
- Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- Use managed Redis (Redis Labs, AWS ElastiCache, etc.)
- Enable Firebase production credentials
- Set appropriate `CORS_ORIGIN`

### Scaling Considerations

- **Horizontal Scaling**: Socket.IO Redis adapter allows multiple server instances
- **Database**: Use connection pooling (configured in `database.js`)
- **Redis**: Use Redis Cluster for high availability
- **Load Balancer**: Use sticky sessions for WebSocket connections

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Test connection
psql -U postgres -h localhost -p 5432 -d handshake_db
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check authentication
redis-cli -a YOUR_PASSWORD ping
```

### Firebase Issues
- Verify credentials are correctly formatted in `.env`
- Ensure private key has `\n` for line breaks
- Check Firebase project has Cloud Messaging enabled

## 📝 License

ISC

## 👥 Support

For issues and questions, please open an issue on the project repository.

---

**Built with ❤️ for seamless peer-to-peer gaming experiences**
