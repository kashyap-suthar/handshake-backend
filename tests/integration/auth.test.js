const request = require('supertest');
const { app } = require('../../src/server');
const { User } = require('../../src/models');
const { generateToken } = require('../../src/middleware/auth');

describe('Auth API Integration Tests', () => {
    let authToken;
    let userId;

    // Clean up test data after all tests
    afterAll(async () => {
        if (userId) {
            await User.destroy({ where: { id: userId } });
        }
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toHaveProperty('id');
            expect(response.body.data.user.username).toBe(userData.username);
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.user).not.toHaveProperty('password');
            expect(response.body.data).toHaveProperty('token');

            // Save for later tests
            userId = response.body.data.user.id;
            authToken = response.body.data.token;
        });

        it('should reject duplicate email', async () => {
            const userData = {
                username: 'testuser2',
                email: 'test@example.com', // Same email
                password: 'password123',
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Email already registered');
        });

        it('should reject duplicate username', async () => {
            const userData = {
                username: 'testuser', // Same username
                email: 'test2@example.com',
                password: 'password123',
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Username already taken');
        });

        it('should reject invalid email format', async () => {
            const userData = {
                username: 'testuser3',
                email: 'invalid-email',
                password: 'password123',
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should reject short password', async () => {
            const userData = {
                username: 'testuser4',
                email: 'test4@example.com',
                password: '123', // Too short
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123',
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('token');
        });

        it('should reject invalid email', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'password123',
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid credentials');
        });

        it('should reject invalid password', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'wrongpassword',
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid credentials');
        });
    });

    describe('GET /api/v1/auth/profile', () => {
        it('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toHaveProperty('id');
            expect(response.body.data.user.username).toBe('testuser');
        });

        it('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });
});
