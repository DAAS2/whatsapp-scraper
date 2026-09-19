# WhatsApp Link Summariser

A WhatsApp-based link summarisation agent that turns URLs sent in chat into useful, readable replies.

Send the bot a supported link and it fetches the relevant content, extracts the important information, optionally uses AI to create a concise summary, and responds directly in WhatsApp.

> Built for personal productivity, shared chats, and quickly understanding links without leaving WhatsApp.

## Features

- Receive and process URLs sent through WhatsApp
- Detect multiple links in a single message
- Extract content from supported platforms:
  - GitHub repositories
  - Instagram posts and profiles
  - Reddit posts
  - X/Twitter posts
  - YouTube videos
  - General web pages
- Fetch and clean page content before processing
- Generate short, chat-friendly summaries with optional AI support
- Reply directly to the originating WhatsApp chat
- Configurable environment variables and modular provider architecture
- Separate scraping, extraction, AI, rendering, and WhatsApp layers for easier extension

## How it works

```text
WhatsApp message containing URL(s)
            ↓
URL detection and routing
            ↓
Platform-specific scraper or generic web fetcher
            ↓
Content extraction and normalisation
            ↓
Optional AI summarisation
            ↓
Formatted WhatsApp reply
```

## Project structure

```text
src/
├── ai/          # AI provider integration and summarisation
├── extract/     # Content extraction and normalisation
├── render/      # WhatsApp-friendly response formatting
├── scrape/      # Site-specific and generic URL scrapers
├── whatsapp/    # WhatsApp connection and message handling
├── cli.js       # Command-line entry point
├── config.js    # Environment/configuration loading
└── pipeline.js  # End-to-end link-processing pipeline
```

## Getting started

### Prerequisites

- Node.js 18 or later
- npm
- A WhatsApp account available for QR-code authentication
- An AI API key if you want AI-generated summaries

### Installation

```bash
git clone [https://github.com/DAAS2/whatsapp-scraper.git](https://github.com/DAAS2/whatsapp-scraper.git)
cd whatsapp-scraper
npm install
```

### Configure environment variables

Create a local environment file:

```bash
cp .env.example .env
```

Then update `.env` with the values required by your chosen AI provider and runtime configuration.

Never commit `.env`, WhatsApp session data, or API keys. The repository’s `.gitignore` is configured to exclude these local files.

### Run the bot

```bash
npm start
```

On the first run, scan the QR code with WhatsApp to authenticate the session.

After connecting, send a supported URL to the configured WhatsApp chat. The bot will process the link and respond with an extracted or AI-generated summary.

## Supported sources

| Source | Support |
|---|---|
| GitHub | Repository and link metadata extraction |
| Instagram | Post/profile content extraction where accessible |
| Reddit | Post content extraction |
| X/Twitter | Post link handling and extraction |
| YouTube | Video link extraction |
| Other websites | Generic page fetching and content extraction |

Availability may depend on a platform’s public access rules, login requirements, rate limits, robots policies, and changes to its page structure.

## Configuration

Use `.env.example` as the source of truth for available environment variables.

Typical configuration includes:

```env
# AI provider credentials
OPENAI_API_KEY=your_api_key_here

# Optional AI model configuration
OPENAI_MODEL=your_model_name

# Runtime/logging settings
LOG_LEVEL=info
```

The exact variable names and required values may vary as the project evolves, so check `.env.example` before running the application.

## Development

Run the project locally:

```bash
npm install
npm start
```

Useful places to extend the application:

- Add a new platform handler in `src/scrape/`
- Register the handler through the scraper registry/router
- Improve content cleaning in `src/extract/`
- Change response formatting in `src/render/`
- Swap or extend AI behaviour in `src/ai/`
- Update message handling in `src/whatsapp/`

## Privacy and responsible use

This project is intended for processing links that you are permitted to access and share.

- Do not use it to access private content, bypass authentication, evade platform restrictions, or collect personal data without permission.
- Respect the terms of service, robots policies, copyright, and rate limits of websites you process.
- Treat WhatsApp session files and API keys as sensitive credentials.
- Use the bot only in chats where participants understand and consent to its presence and behaviour.

## Limitations

- Social platforms frequently change their page structure and access controls.
- Some sites require authentication or restrict automated access.
- AI summaries can be incomplete or inaccurate; verify important information at the original source.
- WhatsApp automation may be subject to platform restrictions and account-level risk.

## License

MIT 
