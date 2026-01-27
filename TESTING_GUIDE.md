# Backend Testing Guide (No Mobile App Required)

## 🧪 What You Can Test

✅ **Full REST API** - All endpoints with Postman/curl
✅ **WebSocket events** - Using Postman or Socket.IO client
✅ **Database operations** - User creation, challenges, sessions
✅ **Handshake flow** - Challenge → Accept → Respond → Session
✅ **FCM notification attempt** - Backend will try to send (but won't deliver without real device token)

❌ **Cannot test:** Actual push notification delivery (needs real mobile device)

---

## 📋 Complete Test Flow

### Step 1: Health Check

**Request:**
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-01-27T03:00:00.000Z",
  "uptime": 12.34
}
```

---

### Step 2: Register Player A

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"playerA\",\"email\":\"playerA@test.com\",\"password\":\"password123\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "playerA",
      "email": "playerA@test.com",
      "isActive": true,
      "deviceTokens": [],
      "createdAt": "2026-01-27T03:00:00.000Z",
      "updatedAt": "2026-01-27T03:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**📝 Save:**
- `user.id` as `PLAYER_A_ID`
- `token` as `PLAYER_A_TOKEN`

---

### Step 3: Register Player B

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"playerB\",\"email\":\"playerB@test.com\",\"password\":\"password123\"}"
```

**📝 Save:**
- `user.id` as `PLAYER_B_ID`
- `token` as `PLAYER_B_TOKEN`

---

### Step 4: (Optional) Register Fake Device Token

This won't send real notifications, but tests the token registration:

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/presence/register-device \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PLAYER_A_TOKEN" \
  -d "{\"token\":\"fake-fcm-token-for-testing-123\",\"platform\":\"ios\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Device token registered successfully"
}
```

---

### Step 5: Player A Creates Challenge

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/challenges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PLAYER_A_TOKEN" \
  -d "{\"challengedId\":\"PLAYER_B_ID\",\"gameType\":\"Chess\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "challenge": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "challengerId": "PLAYER_A_ID",
      "challengedId": "PLAYER_B_ID",
      "gameType": "Chess",
      "state": "PENDING",
      "expiresAt": "2026-01-27T04:00:00.000Z",
      "notificationAttempts": 0,
      "metadata": {},
      "createdAt": "2026-01-27T03:00:00.000Z",
      "updatedAt": "2026-01-27T03:00:00.000Z"
    }
  }
}
```

**📝 Save:** `challenge.id` as `CHALLENGE_ID`

---

### Step 6: Player B Accepts Challenge (Triggers Handshake!)

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/challenges/CHALLENGE_ID/accept \
  -H "Authorization: Bearer PLAYER_B_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "challengeId": "CHALLENGE_ID",
    "playerANotified": true,
    "state": "WAITING_RESPONSE"
  },
  "message": "Challenge accepted, notifying opponent..."
}
```

**🔍 What Happened:**
1. Challenge state changed: PENDING → NOTIFYING → WAITING_RESPONSE
2. Backend checked if Player A is online (not online via WebSocket)
3. Backend attempted to send FCM notification (will fail with fake token, but that's OK)
4. Timeout job scheduled (30 seconds)

**Check server logs** - you'll see:
```
✓ Initiating handshake for challenge CHALLENGE_ID
📲 FCM notification sent: false (expected - no real device)
⏰ Scheduled timeout job for challenge CHALLENGE_ID (attempt 1)
```

---

### Step 7: Player A Responds to Wake-up

**Simulate Player A accepting the challenge:**

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/challenges/CHALLENGE_ID/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PLAYER_A_TOKEN" \
  -d "{\"response\":\"ACCEPT\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "action": "SESSION_CREATED",
    "sessionId": "770e8400-e29b-41d4-a716-446655440002",
    "challengeId": "CHALLENGE_ID"
  }
}
```

**🎉 SESSION CREATED!**

**📝 Save:** `sessionId` as `SESSION_ID`

---

### Step 8: Get Session Details

**Request:**
```bash
curl http://localhost:3000/api/v1/sessions/SESSION_ID \
  -H "Authorization: Bearer PLAYER_A_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "SESSION_ID",
      "challengeId": "CHALLENGE_ID",
      "players": ["PLAYER_A_ID", "PLAYER_B_ID"],
      "state": "ACTIVE",
      "startedAt": "2026-01-27T03:00:00.000Z",
      "endedAt": null,
      "metadata": {
        "gameType": "Chess"
      },
      "createdAt": "2026-01-27T03:00:00.000Z",
      "updatedAt": "2026-01-27T03:00:00.000Z"
    }
  }
}
```

---

### Step 9: Get Active Sessions

**Request:**
```bash
curl http://localhost:3000/api/v1/sessions/me/active \
  -H "Authorization: Bearer PLAYER_A_TOKEN"
```

---

### Step 10: End Session

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/sessions/SESSION_ID/end \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PLAYER_A_TOKEN" \
  -d "{\"state\":\"COMPLETED\",\"metadata\":{\"winner\":\"PLAYER_A_ID\",\"score\":\"10-5\"}}"
```

---

## 🔌 Testing WebSocket with Postman

Postman supports WebSocket testing!

### Step 1: Open WebSocket Request in Postman

1. Create **New** → **WebSocket Request**
2. URL: `ws://localhost:3000`
3. **Query Params**:
   - Key: `token`
   - Value: `PLAYER_A_TOKEN`

### Step 2: Connect

Click **Connect** - you should receive:

```json
{
  "success": true,
  "userId": "PLAYER_A_ID",
  "username": "playerA",
  "timestamp": 1706323200000
}
```

### Step 3: Send Heartbeat

**Send message:**
```json
{
  "event": "heartbeat"
}
```

**Receive:**
```json
{
  "event": "heartbeat-ack",
  "timestamp": 1706323200000
}
```

### Step 4: Listen for Events

Keep the WebSocket open while testing the handshake flow (Steps 5-7 above).

When Player B accepts the challenge, Player A's WebSocket will receive:
```json
{
  "event": "challenge:wake-up",
  "challengeId": "CHALLENGE_ID",
  "challenger": {
    "id": "PLAYER_B_ID",
    "username": "playerB"
  },
  "gameType": "Chess",
  "timestamp": 1706323200000
}
```

### Step 5: Respond via WebSocket

**Send message:**
```json
{
  "event": "challenge:respond",
  "challengeId": "CHALLENGE_ID",
  "response": "ACCEPT"
}
```

**Receive:**
```json
{
  "event": "session:ready",
  "sessionId": "SESSION_ID",
  "challengeId": "CHALLENGE_ID",
  "opponent": {
    "id": "PLAYER_B_ID",
    "username": "playerB"
  },
  "gameType": "Chess"
}
```

---

## 📊 Test Timeout Mechanism

**To test the 3-retry timeout:**

1. Player B accepts challenge (Step 6)
2. **DON'T respond as Player A** (skip Step 7)
3. Wait 30 seconds
4. Check server logs - you'll see retry attempts:

```
⏰ Handling timeout for challenge CHALLENGE_ID (attempt 1)
🔄 Retrying notification for challenge CHALLENGE_ID (attempt 2)
⏰ Scheduled timeout job for challenge CHALLENGE_ID (attempt 2)

... wait 30s ...

⏰ Handling timeout for challenge CHALLENGE_ID (attempt 2)
🔄 Retrying notification for challenge CHALLENGE_ID (attempt 3)

... wait 30s ...

⏰ Handling timeout for challenge CHALLENGE_ID (attempt 3)
⏱ Challenge CHALLENGE_ID timed out after 3 attempts
```

5. Check challenge state:
```bash
curl http://localhost:3000/api/v1/challenges/CHALLENGE_ID \
  -H "Authorization: Bearer PLAYER_B_TOKEN"
```

State will be: `"state": "TIMEOUT"`

---

## 🎯 Testing Checklist

- [ ] Health check works
- [ ] User registration works
- [ ] JWT tokens are generated
- [ ] Challenge creation works
- [ ] Challenge acceptance triggers handshake
- [ ] Player A can respond via REST API
- [ ] Session is created when both accept
- [ ] Session details are retrievable
- [ ] Session can be ended
- [ ] WebSocket connection works (Postman)
- [ ] WebSocket events are received
- [ ] Timeout mechanism works (wait 90s total)

---

## 📦 Postman Collection (Import This!)

Create a file `handshake-backend.postman_collection.json`:

```json
{
  "info": {
    "name": "Handshake Backend",
    "_postman_id": "12345678-1234-1234-1234-123456789012",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "playerA_token",
      "value": ""
    },
    {
      "key": "playerB_token",
      "value": ""
    },
    {
      "key": "challengeId",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "Register Player A",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": "{{baseUrl}}/api/v1/auth/register",
        "body": {
          "mode": "raw",
          "raw": "{\"username\":\"playerA\",\"email\":\"playerA@test.com\",\"password\":\"password123\"}"
        }
      }
    }
  ]
}
```

---

## 🚀 Ready to Test!

**Start your server:**
```bash
yarn dev
```

**Then run the curl commands** or **import to Postman** and start testing!

The backend is fully functional even without a mobile app! 🎉
