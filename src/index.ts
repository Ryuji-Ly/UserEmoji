import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageFlags,
  MessageContextMenuCommandInteraction,
  Partials
} from 'discord.js';

import { config } from './config';
import { handleEmojiButton, handleMessageCommand, handleSlashCommand } from './emoji';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'scan-emojis') {
      await handleSlashCommand(interaction as ChatInputCommandInteraction);
      return;
    }

    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Extract Emojis') {
      await handleMessageCommand(interaction as MessageContextMenuCommandInteraction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('emoji-nav:')) {
      await handleEmojiButton(interaction as ButtonInteraction);
    }
  } catch (error) {
    const content = error instanceof Error ? error.message : 'Unexpected error while scanning the message.';

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }

    console.error(error);
  }
});

client.login(config.token).catch((error) => {
  console.error('Failed to login:', error);
  process.exitCode = 1;
});