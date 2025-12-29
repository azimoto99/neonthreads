# Authentication Setup Guide

This guide explains how to set up user authentication with a Render PostgreSQL database.

## Overview

The application now supports:
- User registration and login
- JWT token-based authentication
- PostgreSQL database support (with SQLite fallback for development)
- Protected API routes
- User-specific character management

## Database Setup

### 1. Create PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `neon-threads-db` (or your preferred name)
   - **Region:** Same as your backend service
   - **Plan:** Free tier is fine for development
4. Click **"Create Database"**
5. **Copy the Internal Database URL** (you'll need this)

### 2. Update Environment Variables

In your **Backend Web Service** (`neon-threads-api`) environment variables, add:

```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-very-secure-random-secret-key-here
```

**Important:**
- `DATABASE_URL` - Use the Internal Database URL from Render (starts with `postgresql://`)
- `JWT_SECRET` - Generate a strong random string (you can use: `openssl rand -base64 32`)

### 3. Database Migration

The database will automatically create tables on first run. The schema includes:
- `users` - User accounts with email, password hash, username
- `characters` - Character data linked to users
- `story_events` - Story history
- `world_state` - Game world state

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "username": "optional_username"
  }
  ```

- `POST /api/auth/login` - Login user
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

- `GET /api/auth/me` - Get current user (requires auth token)

### Protected Routes

All character and story routes now require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Frontend Changes

The frontend now includes:
- Login/Register components
- Automatic token storage in localStorage
- Authenticated API calls
- User session management

## Development vs Production

- **Development:** Uses SQLite (no DATABASE_URL needed)
- **Production:** Uses PostgreSQL (DATABASE_URL required)

The code automatically detects which database to use based on the `DATABASE_URL` environment variable.

## Security Notes

1. **JWT_SECRET:** Must be set in production - never commit to git
2. **Passwords:** Hashed with bcrypt (10 rounds)
3. **Tokens:** Expire after 7 days
4. **CORS:** Configured to allow your frontend domain

## Testing

1. Register a new account
2. Login with your credentials
3. Create a character (now linked to your account)
4. All characters are private to your account

