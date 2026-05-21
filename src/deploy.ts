import { REST, Routes } from 'discord.js';

import { config } from './config';
import { messageCommand, slashCommand } from './emoji';

async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const commands = [slashCommand.toJSON(), messageCommand.toJSON()];

  if (config.devGuildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.devGuildId), {
      body: commands
    });

    console.log(`Registered commands in guild ${config.devGuildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.clientId), {
    body: commands
  });

  console.log('Registered global application commands.');
}

deployCommands().catch((error) => {
  console.error('Failed to deploy commands:', error);
  process.exitCode = 1;
});