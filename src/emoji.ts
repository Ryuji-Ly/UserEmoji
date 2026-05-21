import {
  ActionRowBuilder,
  ApplicationCommandType,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  Message,
  MessageFlags,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder
} from 'discord.js';

export type EmojiAsset = {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  sources: Set<'content' | 'reaction'>;
};

type EmojiSession = {
  ownerId: string;
  assets: EmojiAsset[];
  index: number;
  messageUrl: string;
  expiresAt: number;
};

const CUSTOM_EMOJI_REGEX = /<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>/g;
const SESSION_TTL_MS = 15 * 60 * 1000;
const sessions = new Map<string, EmojiSession>();

export const messageCommand = new ContextMenuCommandBuilder()
  .setName('Extract Emojis')
  .setType(ApplicationCommandType.Message)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  );

export const slashCommand = new SlashCommandBuilder()
  .setName('scan-emojis')
  .setDescription('Extract custom emojis from a specific message.')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  )
  .addStringOption((option) =>
    option
      .setName('message-link')
      .setDescription('Full Discord message link to scan.')
  )
  .addStringOption((option) =>
    option
      .setName('message-id')
      .setDescription('Message ID to scan in the selected or current channel.')
  )
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Channel containing the message. Defaults to the current channel.')
  );

function buildEmojiUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=4096&quality=lossless`;
}

function upsertAsset(assetMap: Map<string, EmojiAsset>, nextAsset: Omit<EmojiAsset, 'sources'> & { source: 'content' | 'reaction' }): void {
  const existing = assetMap.get(nextAsset.id);

  if (existing) {
    existing.sources.add(nextAsset.source);
    return;
  }

  assetMap.set(nextAsset.id, {
    id: nextAsset.id,
    name: nextAsset.name,
    animated: nextAsset.animated,
    url: nextAsset.url,
    sources: new Set([nextAsset.source])
  });
}

export function extractEmojiAssets(message: Message): EmojiAsset[] {
  const assetMap = new Map<string, EmojiAsset>();

  for (const match of message.content.matchAll(CUSTOM_EMOJI_REGEX)) {
    const animated = match[1] === 'a';
    const name = match[2];
    const id = match[3];

    upsertAsset(assetMap, {
      id,
      name,
      animated,
      url: buildEmojiUrl(id, animated),
      source: 'content'
    });
  }

  for (const reaction of message.reactions.cache.values()) {
    if (!reaction.emoji.id) {
      continue;
    }

    upsertAsset(assetMap, {
      id: reaction.emoji.id,
      name: reaction.emoji.name ?? 'custom_emoji',
      animated: Boolean(reaction.emoji.animated),
      url: buildEmojiUrl(reaction.emoji.id, Boolean(reaction.emoji.animated)),
      source: 'reaction'
    });
  }

  return [...assetMap.values()];
}

function buildViewerEmbed(messageUrl: string, assets: EmojiAsset[], index: number): EmbedBuilder {
  const asset = assets[index];
  const sourceText = [...asset.sources].join(', ');

  return new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`Emoji ${index + 1} of ${assets.length}`)
    .setDescription([
      `**Name:** ${asset.name}`,
      `**ID:** ${asset.id}`,
      `**Animated:** ${asset.animated ? 'Yes' : 'No'}`,
      `**Found in:** ${sourceText}`,
      `**Message:** [Jump to message](${messageUrl})`
    ].join('\n'))
    .setImage(asset.url)
    .setFooter({ text: 'Use the arrows to browse all extracted custom emojis.' });
}

function buildViewerComponents(sessionId: string, assets: EmojiAsset[], index: number) {
  const asset = assets[index];

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`emoji-nav:${sessionId}:prev`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === 0),
      new ButtonBuilder()
        .setCustomId(`emoji-nav:${sessionId}:next`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === assets.length - 1),
      new ButtonBuilder()
        .setLabel(asset.animated ? 'Download GIF' : 'Download PNG')
        .setStyle(ButtonStyle.Link)
        .setURL(asset.url)
    )
  ];
}

function createSession(ownerId: string, assets: EmojiAsset[], messageUrl: string): string {
  const sessionId = Math.random().toString(36).slice(2, 10);

  sessions.set(sessionId, {
    ownerId,
    assets,
    index: 0,
    messageUrl,
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  return sessionId;
}

function pruneExpiredSessions(): void {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

function parseMessageLink(messageLink: string): { channelId: string; messageId: string } | null {
  const match = messageLink.match(/^https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(?:@me|\d+)\/(\d+)\/(\d+)$/i);

  if (!match) {
    return null;
  }

  return {
    channelId: match[1],
    messageId: match[2]
  };
}

async function fetchTargetMessage(interaction: ChatInputCommandInteraction): Promise<Message> {
  const messageLink = interaction.options.getString('message-link');
  const messageId = interaction.options.getString('message-id');
  const selectedChannel = interaction.options.getChannel('channel');

  if (!messageLink && !messageId) {
    throw new Error('Provide either message-link or message-id.');
  }

  if (messageLink && messageId) {
    throw new Error('Use either message-link or message-id, not both.');
  }

  if (messageLink) {
    const parsed = parseMessageLink(messageLink);

    if (!parsed) {
      throw new Error('The message-link must be a valid Discord message URL.');
    }

    const channel = await interaction.client.channels.fetch(parsed.channelId);

    if (!channel || !('messages' in channel)) {
      throw new Error('That message link does not point to a text channel I can read.');
    }

    return channel.messages.fetch(parsed.messageId);
  }

  const channel = selectedChannel ?? interaction.channel;

  if (!channel || !('messages' in channel)) {
    throw new Error('This command needs a text channel to resolve the message.');
  }

  return channel.messages.fetch(messageId!);
}

async function replyWithAssets(
  interaction: MessageContextMenuCommandInteraction | ChatInputCommandInteraction,
  message: Message
): Promise<void> {
  const assets = extractEmojiAssets(message);

  if (assets.length === 0) {
    await interaction.reply({
      content: 'No custom emojis were found in that message or its reactions.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const sessionId = createSession(interaction.user.id, assets, message.url);

  await interaction.reply({
    embeds: [buildViewerEmbed(message.url, assets, 0)],
    components: buildViewerComponents(sessionId, assets, 0),
    flags: MessageFlags.Ephemeral
  });
}

export async function handleMessageCommand(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const targetMessage = interaction.targetMessage;
  await replyWithAssets(interaction, targetMessage);
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetMessage = await fetchTargetMessage(interaction);
  await replyWithAssets(interaction, targetMessage);
}

export async function handleEmojiButton(interaction: ButtonInteraction): Promise<void> {
  pruneExpiredSessions();

  const [prefix, sessionId, direction] = interaction.customId.split(':');

  if (prefix !== 'emoji-nav' || !sessionId || !direction) {
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    await interaction.reply({
      content: 'This viewer has expired. Run the command again to rebuild it.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (session.ownerId !== interaction.user.id) {
    await interaction.reply({
      content: 'Only the user who opened this emoji viewer can page through it.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (direction === 'prev') {
    session.index = Math.max(0, session.index - 1);
  }

  if (direction === 'next') {
    session.index = Math.min(session.assets.length - 1, session.index + 1);
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;

  await interaction.update({
    embeds: [buildViewerEmbed(session.messageUrl, session.assets, session.index)],
    components: buildViewerComponents(sessionId, session.assets, session.index)
  });
}