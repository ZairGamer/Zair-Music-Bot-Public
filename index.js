const { Client, GatewayDispatchEvents, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Riffy } = require("riffy");
const { Spotify } = require("riffy-spotify");
const config = require("./config.js");
const messages = require("./utils/messages.js");
const { getDurationString } = messages;
const emojis = require("./emojis.js");
const trackCommentsDB = {};
const fs = require('fs');
const path = './channelSettings.json';
const { parseTimeArgs } = require('./utils/messages.js');

let channelSettings = {};

function loadChannelSettings() {
  if (fs.existsSync(path)) {
    try {
      channelSettings = JSON.parse(fs.readFileSync(path));
    } catch {
      channelSettings = {};
    }
  }
}

function saveChannelSettings() {
  fs.writeFileSync(path, JSON.stringify(channelSettings, null, 2));
}

loadChannelSettings();

function addCommentToTrack(trackUri, comment) {
  if (!trackCommentsDB[trackUri]) trackCommentsDB[trackUri] = [];
  trackCommentsDB[trackUri].push(comment);
}

function getCommentsForTrack(trackUri) {
  return trackCommentsDB[trackUri] || [];
}

const client = new Client({
    intents: [
        "Guilds",
        "GuildMessages",
        "GuildVoiceStates",
        "GuildMessageReactions",
        "MessageContent",
        "DirectMessages",
    ],
});

const commands = [
    { name: 'play', description: 'Play a song or playlist' },
    { name: 'pause', description: 'Pause the current track' },
    { name: 'resume', description: 'Resume the current track' },
    { name: 'skip', description: 'Skip the current track' },
    { name: 'stop', description: 'Stop playback and clear queue' },
    { name: 'queue', description: 'Show the current queue' },
    { name: 'nowplaying', description: 'Show current track info' },
    { name: 'volume', description: 'Adjust player volume' },
    { name: 'shuffle', description: 'Shuffle the current queue' },
    { name: 'loop', description: 'Toggle queue loop mode' },
    { name: 'remove', description: 'Remove a track from queue' },
    { name: 'clear', description: 'Clear the current queue' },
    { name: 'status', description: 'Show player status' },
    { name: 'help', description: 'Show this help message' },
    { name: 'comment', description: 'Add a comment to the current track' },
    { name: 'comments', description: 'Show comments for the current track' },
    { name: 'setchannel', description: 'Set the current channel as the allowed command channel' },
    { name: 'clearchannel', description: 'Remove command channel restriction' },
    { name: 'goto', description: 'Go to a specific time in the current track' }
];

const slashCommands = commands.map(cmd => {
    const builder = new SlashCommandBuilder().setName(cmd.name).setDescription(cmd.description);
    if (cmd.name === 'play') builder.addStringOption(opt => opt.setName('query').setDescription('Song name or URL').setRequired(true));
    if (cmd.name === 'volume') builder.addIntegerOption(opt => opt.setName('level').setDescription('0-100').setRequired(true));
    if (cmd.name === 'remove') builder.addIntegerOption(opt => opt.setName('position').setDescription('Track position in queue').setRequired(true));
    if (cmd.name === 'comment') builder.addStringOption(opt => opt.setName('text').setDescription('Comentario para la canción').setRequired(true).setMaxLength(50));
    if (cmd.name === 'goto') builder.addIntegerOption(o => o.setName('segundo').setDescription('Segundo al que saltar').setRequired(true)).addIntegerOption(o => o.setName('minuto').setDescription('Minuto (opcional)').setRequired(false)).addIntegerOption(o => o.setName('hora').setDescription('Hora (opcional)').setRequired(false));
    return builder;
});

const spotify = new Spotify({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret
});

client.riffy = new Riffy(client, config.nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: "ytmsearch",
    restVersion: "v4",
    plugins: [spotify]
});

const rest = new REST({ version: '10' }).setToken(config.botToken);

client.once("ready", async () => {
    client.riffy.init(client.user.id);
    console.log(`${emojis.success} Logged in as ${client.user.tag}`);

    const activities = [
        { name: '!help', type: 0 },
        { name: '/help', type: 1 },
        { name: '!comment', type: 3 },
        { name: '!comments', type: 2 },
    ];
    let idx = 0;
    client.user.setActivity(activities[idx].name, { type: activities[idx].type });
    client.user.setStatus('idle');
    setInterval(() => {
        idx = (idx + 1) % activities.length;
        client.user.setActivity(activities[idx].name, { type: activities[idx].type });
    }, 300000);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), {
            body: slashCommands.map(cmd => cmd.toJSON())
        });
        console.log(`${emojis.success} Slash commands registered successfully.`);
    } catch (err) {
        console.error("Error registering slash commands:", err);
    }
});

// Función para ejecutar la lógica del comando, reutilizada por message y slash
async function handleCommand(command, args, context) {
    const { message, interaction } = context;

    const guildId = message ? message.guild.id : interaction.guild.id;
    const channelId = message ? message.channel.id : interaction.channel.id;

    if (channelSettings[guildId] && channelSettings[guildId] !== channelId) {
        const content = `❌ Solo se permiten comandos en <#${channelSettings[guildId]}>.`;
        if (message) return messages.error(message.channel, content);
        else return interaction.reply({ content, ephemeral: true });
    }

    // Comprobar voice channel solo en comandos de música
    const musicCommands = ["play", "skip", "stop", "pause", "resume", "queue", "nowplaying", "volume", "shuffle", "loop", "remove", "clear"];
    if (musicCommands.includes(command)) {
    const member = message ? message.member : interaction.member;

    if (!member.voice.channel) {
        const content = "❌ Debes estar en un canal de voz para usar este comando.";
        if (message) return messages.error(message.channel, content);
        else return interaction.reply({ content, ephemeral: true });
    }

    const memberGuildId = member.voice.channel.guild.id;
    const commandGuildId = message ? message.guild.id : interaction.guild.id;

    if (memberGuildId !== commandGuildId) {
        const content = "❌ Estás conectado a un canal de voz en otro servidor. Usa el comando en el servidor correcto.";
        if (message) return messages.error(message.channel, content);
        else return interaction.reply({ content, ephemeral: true });
    }
}

    try {
        switch (command) {
            case "help": {
                if (message) messages.help(message.channel, commands);
                else interaction.reply({ content: commands.map(c => `**${c.name}**: ${c.description}`).join("\n"), ephemeral: true });
                break;
            }
            case "play": {
                const query = args.join(" ");
                if (!query) {
                    if (message) return messages.error(message.channel, "Please provide a search query!");
                    else return interaction.reply({ content: "Please provide a search query!", ephemeral: true });
                }

                const member = message ? message.member : interaction.member;
                const channel = message ? message.channel : interaction.channel;

                if (!message) {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ ephemeral: true });
                    }
                }

                const player = client.riffy.createConnection({
                    guildId: member.guild.id,
                    voiceChannel: member.voice.channel.id,
                    textChannel: channel.id,
                    deaf: true,
                });

                const resolve = await client.riffy.resolve({
                    query,
                    requester: member.user || member,
                });

                const { loadType, tracks, playlistInfo } = resolve;

                if (loadType === "playlist") {
                    for (const track of tracks) {
                        track.info.requester = member.user || member;
                        player.queue.add(track);
                    }
                    if (!player.queue.current && tracks.length > 0) {
                        player.queue.current = tracks[0];
                    }
                    if (message) {
                        messages.addedPlaylist(channel, playlistInfo, tracks);
                    } else {
                        await interaction.editReply({
                            content: `Added playlist **${playlistInfo.name}** with ${tracks.length} tracks!`
                        });
                    }

                    if (!player.playing && !player.paused) player.play();
                } else if (loadType === "search" || loadType === "track") {
                    const track = tracks.shift();
                    track.info.requester = member.user || member;
                    player.queue.add(track);

                    if (!player.queue.current) {
                         player.queue.current = track;
                    }

                    if (message) {
                        messages.addedToQueue(channel, track, player.queue.length);
                    } else {
                        await interaction.editReply({
                            content: `Added **${track.info.title}** to queue!`
                        });
                    }

                    if (!player.playing && !player.paused) player.play();
                } else {
                    if (message) {
                        messages.error(channel, "No results found! Try with a different search term.");
                    } else {
                        await interaction.editReply({
                            content: "No results found! Try with a different search term."
                        });
                    }
                }
                break;
            }
            case "skip": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                if (!player.queue.length) {
                    if (message) return messages.error(channel, "No more tracks in queue to skip to!");
                    else return interaction.reply({ content: "No more tracks in queue to skip to!", ephemeral: true });
                }
                player.stop();
                if (message) messages.success(channel, "Skipped the current track!");
                else interaction.reply({ content: "Skipped the current track!", ephemeral: true });
                break;
            }
            case "stop": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                player.destroy();
                if (message) messages.success(channel, "Stopped the music and cleared the queue!");
                else interaction.reply({ content: "Stopped the music and cleared the queue!", ephemeral: true });
                break;
            }
            case "pause": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                if (player.paused) {
                    if (message) return messages.error(channel, "The player is already paused!");
                    else return interaction.reply({ content: "The player is already paused!", ephemeral: true });
                }
                player.pause(true);
                if (message) messages.success(channel, "Paused the music!");
                else interaction.reply({ content: "Paused the music!", ephemeral: true });
                break;
            }
            case "resume": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                if (!player.paused) {
                    if (message) return messages.error(channel, "The player is already playing!");
                    else return interaction.reply({ content: "The player is already playing!", ephemeral: true });
                }
                player.pause(false);
                if (message) messages.success(channel, "Resumed the music!");
                else interaction.reply({ content: "Resumed the music!", ephemeral: true });
                break;
            }
            case "queue": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                const queue = player.queue;
                if (!queue.length && !player.queue.current) {
                    if (message) return messages.error(channel, "Queue is empty! Add some tracks with the play command.");
                    else return interaction.reply({ content: "Queue is empty! Add some tracks with the play command.", ephemeral: true });
                }
                if (message) messages.queueList(channel, queue, player.queue.current);
                else {
                    const list = queue.map((track, i) => `${i + 1}. ${track.info.title}`).join("\n");
                    interaction.reply({ content: `Current queue:\n${list}`, ephemeral: true });
                }
                break;
            }
            case "nowplaying": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                if (!player.queue.current) {
                    if (message) return messages.error(channel, "No track is currently playing!");
                    else return interaction.reply({ content: "No track is currently playing!", ephemeral: true });
                }
                const comments = getCommentsForTrack(player.queue.current.info.uri);
                if (message) messages.nowPlaying(channel, player.queue.current, comments);
                else interaction.reply({ content: `Now playing: **${player.queue.current.info.title}**`, ephemeral: true });
                break;
            }
            case "volume": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                const volume = message ? parseInt(args[0]) : interaction.options.getInteger('level');
                if ((volume === undefined) || isNaN(volume) || volume < 0 || volume > 100) {
                    if (message) return messages.error(channel, "Please provide a valid volume between 0 and 100!");
                    else return interaction.reply({ content: "Please provide a valid volume between 0 and 100!", ephemeral: true });
                }
                player.setVolume(volume);
                if (message) messages.success(channel, `Set volume to ${volume}%`);
                else interaction.reply({ content: `Set volume to ${volume}%`, ephemeral: true });
                break;
            }
            case "shuffle": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                if (!player.queue.length) {
                    if (message) return messages.error(channel, "Not enough tracks in queue to shuffle!");
                    else return interaction.reply({ content: "Not enough tracks in queue to shuffle!", ephemeral: true });
                }
                player.queue.shuffle();
                if (message) messages.success(channel, `${emojis.shuffle} Shuffled the queue!`);
                else interaction.reply({ content: "Shuffled the queue!", ephemeral: true });
                break;
            }
            case "loop": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                const currentMode = player.loop;
                const newMode = currentMode === "none" ? "queue" : "none";
                player.setLoop(newMode);
                if (message) messages.success(channel, `${newMode === "queue" ? "Enabled" : "Disabled"} loop mode!`);
                else interaction.reply({ content: `${newMode === "queue" ? "Enabled" : "Disabled"} loop mode!`, ephemeral: true });
                break;
            }
            case "remove": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                const position = message ? parseInt(args[0]) : interaction.options.getInteger('position');
                if (!position || isNaN(position) || position < 1 || position > player.queue.length) {
                    if (message) return messages.error(channel, `Please provide a valid track position between 1 and ${player.queue.length}!`);
                    else return interaction.reply({ content: `Please provide a valid track position between 1 and ${player.queue.length}!`, ephemeral: true });
                }
                const removed = player.queue.remove(position - 1);
                if (message) messages.success(channel, `Removed **${removed.info.title}** from the queue!`);
                else interaction.reply({ content: `Removed **${removed.info.title}** from the queue!`, ephemeral: true });
                break;
            }
            case "clear": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    if (message) return messages.error(channel, "Nothing is playing!");
                    else return interaction.reply({ content: "Nothing is playing!", ephemeral: true });
                }
                if (!player.queue.length) {
                    if (message) return messages.error(channel, "Queue is already empty!");
                    else return interaction.reply({ content: "Queue is already empty!", ephemeral: true });
                }
                player.queue.clear();
                if (message) messages.success(channel, "Cleared the queue!");
                else interaction.reply({ content: "Cleared the queue!", ephemeral: true });
                break;
            }
            case "comment": {
                const member = message ? message.member : interaction.member;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(member.guild.id);

                if (!player || !player.queue.current) {
                    const content = "❌ No hay canción reproduciéndose para comentar.";
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                const commentText = message ? args.join(" ") : interaction.options.getString('text');
                if (!commentText) {
                    const content = "❌ Debes escribir un comentario.";
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                if (commentText.length > 50) {
                    const content = "❌ El comentario no debe superar los 50 caracteres.";
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                addCommentToTrack(player.queue.current.info.uri, {
                    username: member.user.username,
                    message: commentText
                });

                if (message) {
                    messages.commentAdded(channel, player.queue.current.info.title);
                } else {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ ephemeral: true });
                    }
                    await interaction.editReply({ content: "✅ Comentario agregado." });
                }
                break;      
            }
            case "comments": {
                const member = message ? message.member : interaction.member;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(member.guild.id);

                if (!player || !player.queue.current) {
                    const content = "❌ No hay canción reproduciéndose para mostrar comentarios.";
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                const trackUri = player.queue.current.info.uri;
                const trackTitle = player.queue.current.info.title;
                const trackComments = getCommentsForTrack(trackUri);

                if (message) {
                    messages.showComments(channel, trackTitle, trackComments);
                } else {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ ephemeral: true });
                    }

                    await messages.showComments(interaction.channel, trackTitle, trackComments);
                    
                    await interaction.editReply({ content: "Comentarios mostrados." });
                }
                break;
            }
            case "setchannel": {
                const member = message ? message.member : interaction.member;
                const channel = message ? message.channel : interaction.channel;

                if (!member.permissions.has("Administrator")) {
                    const content = "❌ Solo un administrador puede usar este comando.";
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                channelSettings[member.guild.id] = channel.id;
                saveChannelSettings();

                const content = `✅ Este canal (**#${channel.name}**) ahora está configurado para recibir comandos.`;
                if (message) messages.success(channel, content);
                else interaction.reply({ content, ephemeral: true });

                break;
            }
            case "clearchannel": {
                const member = message ? message.member : interaction.member;
                const channel = message ? message.channel : interaction.channel;

                if (!member.permissions.has("Administrator")) {
                    const content = "❌ Solo un administrador puede usar este comando.";
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                delete channelSettings[member.guild.id];
                saveChannelSettings();

                const content = "✅ Se eliminó la restricción de canal para comandos. Ahora se pueden usar en cualquier canal.";
                if (message) messages.success(channel, content);
                else interaction.reply({ content, ephemeral: true });

                break;
            }
            case 'goto': {
                let targetMs;

                if (message) {
                    const args = message.content.split(' ').slice(1);
                    targetMs = parseTimeArgs(args);
                } else {
                    const hora = interaction.options.getInteger('hora') || 0;
                    const minuto = interaction.options.getInteger('minuto') || 0;
                    const segundo = interaction.options.getInteger('segundo');

                    if (segundo === null || isNaN(segundo)) {
                        return interaction.reply({ content: '❌ Debes especificar al menos los segundos.', ephemeral: true });
                    }

                    targetMs = (hora * 3600 + minuto * 60 + segundo) * 1000;
                }

                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);
                const track = player?.queue?.current;

                if (!player || !track) {
                    const content = '❌ No hay ninguna canción en reproducción.';
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                if (targetMs >= track.info.duration) {
                    const content = `❌ El tiempo excede la duración de la canción (${getDurationString(track)}).`;
                    if (message) return messages.error(channel, content);
                    else return interaction.reply({ content, ephemeral: true });
                }

                player.seek(targetMs);

                const h = Math.floor(targetMs / 3600000);
                const m = Math.floor((targetMs % 3600000) / 60000);
                const s = Math.floor((targetMs % 60000) / 1000);

                const formatted = [
                    h > 0 ? h.toString().padStart(2, '0') : null,
                    m.toString().padStart(2, '0'),
                    s.toString().padStart(2, '0')
                ].filter(Boolean).join(':');

                let warning = "";
                if (['spotify', 'youtube', 'soundcloud'].includes(track.info.sourceName)) {
                    warning = "\n⚠️ Advertencia: El comando `goto` puede ser poco fiable con algunas canciones debido a limitaciones técnicas.";
                }

                const response = `⏩ Reproducción movida a **${formatted}**.` + warning;

                if (message) return messages.success(channel, response);
                else return interaction.reply({ content: response, ephemeral: true });
            }
            case "status": {
                const guildId = message ? message.guild.id : interaction.guild.id;
                const channel = message ? message.channel : interaction.channel;
                const player = client.riffy.players.get(guildId);

                if (!player) {
                    const content = "❌ No hay un reproductor activo.";
                    if (message) return messages.error(channel, content);
                    else {
                        if (interaction.replied || interaction.deferred) {
                            return interaction.followUp({ content, ephemeral: true });
                        } else {
                            return interaction.reply({ content, ephemeral: true });
                        }
                    }
                }

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

                if (message) {
                  return channel.send({ embeds: [emb] });
                } else {
                  return interaction.reply({ embeds: [emb], ephemeral: true });
                }      
            }
            default:
                if (message) messages.error(message.channel, "Unknown command.");
                else interaction.reply({ content: "Unknown command.", ephemeral: true });
                break;
        }
    } catch (error) {
        console.error(error);
        if (message) messages.error(message.channel, "An error occurred while processing the command.");
        else interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
    }
}

// Listener comandos prefijo
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    await handleCommand(command, args, { message });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (!interaction.inGuild()) {
        return interaction.reply({
            content: "❌ Este comando solo puede usarse en servidores.",
            ephemeral: true
        });
    }

    const command = interaction.commandName;
    const args = interaction.options.data.map(opt => opt.value);

    await handleCommand(command, args, { interaction });
});

// Eventos Riffy
client.riffy.on("nodeConnect", (node) => {
    console.log(`${emojis.success} Node "${node.name}" connected.`);
});

client.riffy.on("nodeError", (node, error) => {
    console.log(`${emojis.error} Node "${node.name}" encountered an error: ${error.message}.`);
});

client.riffy.on("trackStart", async (player, track) => {
  player.queue.current = track;
  const channel = client.channels.cache.get(player.textChannel);
  const comments = getCommentsForTrack(track.info.uri);
  messages.nowPlaying(channel, track, comments);
});

client.riffy.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    player.destroy();
    messages.queueEnded(channel);
});

client.on("raw", (d) => {
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, guildId, channel, message } = interaction;

  // 1) Botones de paginación de cola
  if (customId.startsWith("queue_")) {
    const [, , pageStr] = customId.split("_");
    const page = parseInt(pageStr);
    if (isNaN(page)) return;

    const player = client.riffy.players.get(guildId);
    if (!player) {
      return interaction.reply({ content: "❌ No hay música en reproducción.", ephemeral: true });
    }

    await interaction.deferUpdate();
    // borrar el mensaje con la página anterior
    await interaction.message.delete();

    // volver a enviar la página solicitada
    const messages = require("./utils/messages.js");
    messages.queueList(channel, player.queue, player.queue.current, page);
    return;
  }

  // 2) Botones de control de reproducción
  const player = client.riffy.players.get(guildId);
  if (!player) {
    return interaction.reply({ content: "❌ No hay música en reproducción.", ephemeral: true });
  }

  switch (customId) {
    case "music_pause":
      player.pause(true);
      return interaction.reply({ content: "⏸️ Canción pausada.", ephemeral: true });

    case "music_resume":
      player.pause(false);
      return interaction.reply({ content: "▶️ Canción reanudada.", ephemeral: true });

    case "music_skip":
      player.stop();
      return interaction.reply({ content: "⏭️ Canción saltada.", ephemeral: true });

    case "music_stop":
      player.destroy();
      return interaction.reply({ content: "⏹️ Reproductor detenido.", ephemeral: true });

    default:
      // no reconocido: no hacer nada
      return;
  }
});

client.login(config.botToken);

