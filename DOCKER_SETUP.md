# ✅ Docker Services Setup Complete!

Your PostgreSQL and Redis containers are now running.

## 🔑 Database Credentials

Use these credentials in your `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/handshake_db
DB_PASSWORD=postgres
```

## 📦 Running Containers

- **PostgreSQL**: localhost:5432
  - Database: `handshake_db`
  - Username: `postgres`
  - Password: `postgres`

- **Redis**: localhost:6379

## 🚀 Start the Backend

```powershell
yarn dev
```

Or with npm:
```powershell
npm run dev
```

## 🛠️ Manage Docker Containers

**Stop containers:**
```powershell
docker stop postgres redis
```

**Start containers:**
```powershell
docker start postgres redis
```

**Remove containers (if you need to reset):**
```powershell
docker rm -f postgres redis
```

**View logs:**
```powershell
docker logs postgres
docker logs redis
```

## ✅ Verify Services

**Check PostgreSQL:**
```powershell
docker exec -it postgres psql -U postgres -c "\l"
```

**Check Redis:**
```powershell
redis-cli ping
# Should return: PONG
```

**Check running containers:**
```powershell
docker ps
```

---

**Next:** Make sure your `.env` file has `DB_PASSWORD=postgres` and run `yarn dev`!
