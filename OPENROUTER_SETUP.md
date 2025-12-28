# OpenRouter Setup Guide

## What Changed

The story generation has been switched from Claude API (direct) to **OpenRouter**, which provides access to multiple LLMs including Claude through a unified API.

## Benefits

- ✅ **Lower costs** - OpenRouter often has better pricing
- ✅ **Multiple models** - Can switch between different LLMs easily
- ✅ **Unified API** - Same interface for all models
- ✅ **Better availability** - Less likely to hit rate limits

## Setup Instructions

### 1. Get Your OpenRouter API Key

1. Go to https://openrouter.ai/
2. Sign up or log in
3. Navigate to **Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-or-...`)

### 2. Update Your .env File

Edit `server/.env` and replace/add:

```env
OPENROUTER_API_KEY=sk-or-your-actual-key-here
```

**Remove or comment out:**
```env
# CLAUDE_API_KEY=... (no longer needed)
```

### 3. Restart Your Server

After updating `.env`:
1. Stop the server (Ctrl+C)
2. Run `npm run dev` again
3. Check console for: `✅ OpenRouter API key loaded`

## Model Configuration

The service is currently configured to use:
- **Model:** `anthropic/claude-3.5-sonnet` (Claude through OpenRouter)

You can change this in `server/src/services/aiService.ts`:
```typescript
private static readonly MODEL = 'anthropic/claude-3.5-sonnet';
```

### Other Available Models

You can switch to other models by changing the MODEL constant:

- `anthropic/claude-3.5-sonnet` - Claude 3.5 Sonnet (current)
- `anthropic/claude-3-opus` - Claude 3 Opus (more powerful, more expensive)
- `openai/gpt-4-turbo` - GPT-4 Turbo
- `openai/gpt-4` - GPT-4
- `google/gemini-pro-1.5` - Google Gemini
- `meta-llama/llama-3-70b-instruct` - Llama 3 (often cheaper)

See full list: https://openrouter.ai/models

## Pricing

OpenRouter pricing varies by model. Check current prices at: https://openrouter.ai/models

**Example costs:**
- Claude 3.5 Sonnet: Similar to direct API
- GPT-4 Turbo: ~$0.01-0.03 per request
- Llama 3: Often cheaper, ~$0.001-0.01 per request

## Troubleshooting

### "OPENROUTER_API_KEY is not set"
- Make sure you added the key to `server/.env`
- Restart the server after adding the key

### "API authentication failed"
- Check that your API key is correct
- Make sure there are no extra spaces in the key
- Verify the key starts with `sk-or-`

### "Insufficient credits"
- Add credits at https://openrouter.ai/credits
- OpenRouter uses a credit-based system

### Model not available
- Some models may be temporarily unavailable
- Try switching to a different model in `aiService.ts`
- Check model status at https://openrouter.ai/models

## Testing

After setup:
1. Create a character
2. Generate a story scenario
3. Check server console for any errors
4. Story should generate successfully

## Cost Comparison

**Before (Direct Claude):**
- ~$0.01-0.05 per story action

**After (OpenRouter):**
- Depends on model chosen
- Can be cheaper with models like Llama 3
- Can be similar with Claude through OpenRouter

## Next Steps

1. ✅ Add `OPENROUTER_API_KEY` to `server/.env`
2. ✅ Restart server
3. ✅ Test story generation
4. ⏭️ (Optional) Try different models to find best price/quality balance

