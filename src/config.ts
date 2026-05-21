import dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  token: getRequiredEnv('DISCORD_TOKEN'),
  clientId: getRequiredEnv('DISCORD_CLIENT_ID'),
  clientSecret: process.env.DISCORD_CLIENT_SECRET?.trim() || '',
  devGuildId: process.env.DEV_GUILD_ID?.trim() || ''
};