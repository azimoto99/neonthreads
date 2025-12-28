# API Key Setup - Quick Guide

## Current Issue

Your OpenRouter API key is still set to the placeholder value: `your_openrouter_api_key_here`

This is why you're seeing the error: **"No cookie auth credentials found"**

## Quick Fix

### Step 1: Get Your OpenRouter API Key

1. Go to **https://openrouter.ai/**
2. Click **Sign In** (or create an account if you don't have one)
3. Once logged in, go to **Keys** section (or **https://openrouter.ai/keys**)
4. Click **Create Key** or copy an existing key
5. The key will start with `sk-or-...`

### Step 2: Update Your .env File

1. Open `server/.env` in your editor
2. Find this line:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```
3. Replace it with your actual key:
   ```
   OPENROUTER_API_KEY=sk-or-your-actual-key-here
   ```
4. **Save the file**

### Step 3: Restart the Server

1. Stop the server (press **Ctrl+C** in the terminal)
2. Start it again:
   ```powershell
   npm run dev
   ```
3. You should see: `✅ OpenRouter API key loaded`

## Verify It's Working

After restarting, try creating a character and generating a story. The error should be gone!

## Troubleshooting

### Still seeing "No cookie auth credentials found"?
- Make sure you saved the `.env` file
- Make sure you restarted the server after changing `.env`
- Check that the key starts with `sk-or-`
- Verify there are no extra spaces around the `=` sign

### Key format issues?
- OpenRouter keys should start with `sk-or-`
- Make sure you copied the entire key (they're long!)
- Don't include quotes around the key in `.env`

### Need help?
- OpenRouter docs: https://openrouter.ai/docs
- Check your keys: https://openrouter.ai/keys

## Cost Note

OpenRouter uses a credit-based system. You may need to add credits to your account for the API to work. Check your balance at https://openrouter.ai/credits

