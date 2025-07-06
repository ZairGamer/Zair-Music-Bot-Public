const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojis = require('../emojis.js');
const config = require('../config.js');

function parseTimeArgs(args) {
  let hours = 0, minutes = 0, seconds = 0;

  if (args.length === 1) {
    seconds = parseInt(args[0], 10);
  } else if (args.length === 2) {
    minutes = parseInt(args[0], 10);
    seconds = parseInt(args[1], 10);
  } else if (args.length === 3) {
    hours = parseInt(args[0], 10);
    minutes = parseInt(args[1], 10);
    seconds = parseInt(args[2], 10);
  } else {
    return null; // entrada inválida
  }

  if (
    isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
    minutes < 0 || minutes > 59 ||
    seconds < 0 || seconds > 59
  ) return null;

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function formatDuration(ms) {
  if (!ms || ms <= 0 || ms === 'Infinity') return 'LIVE';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getDurationString(track) {
  try {
    const isStream = track?.info?.isStream ?? track?.isStream ?? false;
    if (isStream) return 'LIVE';
    const duration =
      track?.info?.duration ??
      track?.duration ??
      (typeof track?.info?.length === 'number' ? track.info.length : null);
    if (!duration || isNaN(duration) || duration <= 0 || duration === 'Infinity') {
      console.warn('[Duración inválida]', duration, 'Track:', track?.info?.title);
      return 'N/A';
    }
    return formatDuration(duration);
  } catch (err) {
    console.error('[Error al obtener duración]', err, track);
    return 'N/A';
  }
}

module.exports = {
  success: (channel, message) => channel.send(`${emojis.success} | ${message}`),
  error: (channel, message) => channel.send(`${emojis.error} | ${message}`),

nowPlaying: (channel, track, comments = []) => {
  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(`${emojis.music} Now Playing`)
    .setDescription(`[${track.info.title}](${track.info.uri})`)
    .addFields([
      { name: 'Artist', value: `${emojis.info} ${track.info.author}`, inline: true },
      { name: 'Duration', value: `${emojis.time} ${getDurationString(track)}`, inline: true },
      { name: 'Requested By', value: `${emojis.info} ${track.info.requester.tag}`, inline: true }
    ])
    .setFooter({ text: 'Use !help to see all commands' });

  if (track.info.thumbnail) embed.setThumbnail(track.info.thumbnail);

  const recentComments = comments.slice(-10).reverse();

  if (recentComments.length > 0) {
    const commentsText = recentComments
      .map(c => `**${c.username}**: ${c.message}`)
      .join('\n');
    embed.addFields({ name: '💬 Comentarios – ¡Usa !comment para decir algo!', value: commentsText, inline: false });
  } else {
    embed.addFields({ name: '💬 Comentarios', value: 'Aún nadie ha comentado esta canción. Sé el primero usando `!comment` 🎶', inline: false });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause')
      .setLabel('⏸️ Pause')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_resume')
      .setLabel('▶️ Resume')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('⏭️ Skip')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('⏹️ Stop')
      .setStyle(ButtonStyle.Danger)
  );

  return channel.send({ embeds: [embed], components: [row] });
},

  addedToQueue: (channel, track, position) => {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setDescription(`${emojis.success} Added to queue: [${track.info.title}](${track.info.uri})`)
      .addFields([
        { name: 'Artist', value: `${emojis.info} ${track.info.author}`, inline: true },
        { name: 'Duration', value: `${emojis.time} ${getDurationString(track)}`, inline: true },
        { name: 'Position', value: `${emojis.queue} #${position}`, inline: true }
      ]);

    if (track.info.thumbnail) embed.setThumbnail(track.info.thumbnail);
    return channel.send({ embeds: [embed] });
  },

  addedPlaylist: (channel, playlistInfo, tracks) => {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`${emojis.success} Added Playlist`)
      .setDescription(`**${playlistInfo.name}**`)
      .addFields([
        { name: 'Total Tracks', value: `${emojis.queue} ${tracks.length} tracks`, inline: true },
        { name: 'Total Duration', value: `${emojis.time} ${formatDuration(tracks.reduce((acc, t) => acc + (t.info.duration || 0), 0))}`, inline: true },
        { name: 'Stream Count', value: `${emojis.info} ${tracks.filter(t => t.info.isStream).length} streams`, inline: true }
      ])
      .setFooter({ text: 'The playlist will start playing soon' });

    if (playlistInfo.thumbnail) embed.setThumbnail(playlistInfo.thumbnail);
    return channel.send({ embeds: [embed] });
  },

  queueEnded: channel => channel.send(`${emojis.info} | Queue has ended. Leaving voice channel.`),

  /**
   * Displays the queue in pages of 5 tracks per embed with navigation buttons.
   */
  queueList: (channel, queue, currentTrack, page = 1) => {
    const chunkSize = 5;
    const totalPages = Math.max(Math.ceil(queue.length / chunkSize), 1);
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * chunkSize;
    const pageItems = queue.slice(start, start + chunkSize);

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`${emojis.queue} Queue List`)
      .setDescription(
        (currentTrack
          ? `**Now Playing:**\n${emojis.play} [${currentTrack.info.title}](${currentTrack.info.uri}) - ${getDurationString(currentTrack)}\n\n**Up Next:**\n`
          : '**Queue:**\n') +
        pageItems.map((t, i) =>
          `\`${(start + i + 1).toString().padStart(2, '0')}\` ${emojis.song} [${t.info.title}](${t.info.uri}) - ${getDurationString(t)}`
        ).join('\n')
      )
      .setFooter({ text: `Total Tracks: ${queue.length} • Page ${currentPage}/${totalPages}` });

    if (currentTrack?.info?.thumbnail) embed.setThumbnail(currentTrack.info.thumbnail);

    // Navigation buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`queue_prev_${currentPage - 1}`)
        .setLabel('« Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`queue_next_${currentPage + 1}`)
        .setLabel('Siguiente »')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );

    return channel.send({ embeds: [embed], components: [row] });
  },

  playerStatus: (channel, player) => {
    const emb = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`${emojis.info} Player Status`)
      .addFields([
        { name: 'Status', value: player.playing ? `${emojis.play} Playing` : `${emojis.pause} Paused`, inline: true },
        { name: 'Volume', value: `${emojis.volume} ${player.volume}%`, inline: true },
        { name: 'Loop Mode', value: `${emojis.repeat} ${player.loop === 'queue' ? 'Queue' : 'Disabled'}`, inline: true }
      ]);

    if (player.queue.current) {
      emb.setDescription(
        `**Currently Playing:**\n${emojis.music} [${player.queue.current.info.title}](${player.queue.current.info.uri})\n` +
        `${emojis.time} Duration: ${getDurationString(player.queue.current)}`
      );
      if (player.queue.current.info.thumbnail) emb.setThumbnail(player.queue.current.info.thumbnail);
    }

    return channel.send({ embeds: [emb] });
  },

  commentAdded: (channel, trackTitle) => {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setDescription(`✅ Comentario agregado a la canción: **${trackTitle}**`);
    return channel.send({ embeds: [embed] });
  },

  showComments: async (channel, trackTitle, commentsList) => {
    if (commentsList.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`💬 Comentarios para "${trackTitle}"`)
        .setDescription('No hay comentarios para esta canción.')
        .setColor('#00FFFF');
      return channel.send({ embeds: [embed] });
    }

    const pageSize = 10;
    const totalPages = Math.ceil(commentsList.length / pageSize);
    let currentPage = 0;

    const generateEmbed = (page) => {
      const start = commentsList.length - (page + 1) * pageSize;
      const safeStart = Math.max(start, 0);
      const end = safeStart + pageSize;
      const pageComments = commentsList.slice(safeStart, end);
      const description = pageComments.reverse().map(c => `**${c.username}**: ${c.message}`).join('\n\n');

      return new EmbedBuilder()
        .setTitle(`💬 Comentarios para "${trackTitle}"`)
        .setDescription(description)
        .setFooter({ text: `Página ${page + 1} de ${totalPages}` })
        .setColor('#00FFFF');
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev_comments')
        .setLabel('« Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('next_comments')
        .setLabel('Siguiente »')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1)
    );

    const message = await channel.send({ embeds: [generateEmbed(currentPage)], components: [row] });

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (interaction) => {
      if (!['prev_comments', 'next_comments'].includes(interaction.customId)) return;

      if (interaction.customId === 'prev_comments') {
        currentPage = Math.max(currentPage - 1, 0);
      } else if (interaction.customId === 'next_comments') {
        currentPage = Math.min(currentPage + 1, totalPages - 1);
      }

      row.components[0].setDisabled(currentPage === 0);
      row.components[1].setDisabled(currentPage === totalPages - 1);

      await interaction.update({ embeds: [generateEmbed(currentPage)], components: [row] });
    });

    collector.on('end', () => {
       row.components.forEach(button => button.setDisabled(true));
       message.edit({ components: [row] }).catch(() => { });
    });
  },
  
  help: (channel, commands) => {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`${emojis.info} Available Commands`)
      .setDescription(commands.map(cmd => `${emojis.music} \`${cmd.name}\` - ${cmd.description}`).join('\n'))
      .setFooter({ text: 'Prefix: ! • Example: !play <song name>' });
    return channel.send({ embeds: [embed] });
  }
};

module.exports.getDurationString = getDurationString;
module.exports.parseTimeArgs = parseTimeArgs;
