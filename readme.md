# Steam Stalker Discord Bot

A simple Discord bot that tracks Steam users' gaming activity and displays it in real-time.

## Features

- Track multiple Steam profiles and display their current gaming status
- Automatically updates status at configurable intervals
- Easy to use slash commands
- Colorful embeds with user avatars and game images
- Persistent tracking across bot restarts

## Commands

- `/stalk [steamid]` - Start tracking a Steam profile (requires Manage Channels permission)
- `/stopstalk [steamid]` - Stop tracking a Steam profile (requires Manage Channels permission)
- `/update [seconds]` - Set how frequently the bot updates statuses (60-86400 seconds)

## Setup

1. Create a Discord bot and get its token
2. Get a Steam API key from Steam Developer portal
3. Create a `.env` file with:
   ```
   TOKEN=your_discord_token
   STEAM_API_KEY=your_steam_api_key
   ```
4. Install dependencies: `npm install discord.js axios dotenv`
5. Run the bot: `node index.js`
