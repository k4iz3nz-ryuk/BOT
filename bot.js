const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');

const activeBots = new Map();
let alertChannel = null;

const STAFF_LIST = new Set([
  'henriks9', 'seeken', 'akyss', 'lupu_xx_x', 'ionutz547', 'andreibeni',
  'snaccks', 'gr_veteran', 'osmiumredox', 'bombita_01', 'ld007', 'space_turtle9',
  'urswu', 'gamsterevent', 'xspeed10', 'fredy_9', 'weepinangels', 'h2mzh',
  'doritostar', 'athul', 'godkissed', 'synchitss', '_pixelwarrioryt_',
  'karlthhkiller3', 'pintux', 'wost_ali', 'robi5937', 'mihaaiiii', 'megasus',
  'theashz', 'tini_alina', 'gamster', 'itsb2_', 'officialmex', 'nayskutzu',
  'maria_int', '_shadowxd', 'sneakykutzubot'
]);

// ==========================================
// UTILITY & COOL FONT GENERATORS
// ==========================================
function toCoolFont(str) {
  if (!str) return '';
  const map = {
    a: '𝚊', b: '𝚋', c: '𝚌', d: '𝚍', e: '𝚎', f: '𝚏', g: '𝚐', h: '𝚑', i: '𝚒', j: '𝚓',
    k: '𝚔', l: '𝚕', m: '𝚖', n: '𝚗', o: '𝚘', p: '𝚙', q: '𝚚', r: '𝚛', s: '𝚜', t: '𝚝',
    u: '𝚞', v: '𝚟', w: '𝚠', x: '𝚡', y: '𝚢', z: '𝚣',
    A: '𝙰', B: '𝙱', C: '𝙲', D: '𝙳', E: '𝙴', F: '𝙵', G: '𝙶', H: '𝙷', I: '𝙸', J: '𝙹',
    K: '𝙺', L: '𝙻', M: '𝙼', N: '𝙽', O: '𝙾', P: '𝙿', Q: '𝚀', R: '𝚁', S: '𝚂', T: '𝚃',
    U: '𝚄', V: '𝚅', W: '𝚆', X: '𝚇', Y: '𝚈', Z: '𝚉',
    '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿'
  };
  return str.split('').map(char => map[char] || char).join('');
}

function formatUptime(ms) {
  if (ms <= 0) return '00h 00m 00s';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
}

function makeProgressBar(currentMs, targetMs = 72060000) {
  const percentage = Math.min(Math.max((currentMs / targetMs) * 100, 0), 100);
  const totalBlocks = 12;
  const filledBlocks = Math.round((percentage / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  return `[${bar}]${percentage.toFixed(1)}%`;
}

function parseProxy(proxyStr) {
  if (!proxyStr || !proxyStr.trim()) return null;
  let clean = proxyStr.trim().replace('socks5://', '');
  const parts = clean.split(':');
  if (parts.length >= 4) {
    return { host: parts[0], port: parseInt(parts[1], 10), userId: parts[2], password: parts.slice(3).join(':') };
  } else if (parts.length === 2) {
    return { host: parts[0], port: parseInt(parts[1], 10) };
  }
  return null;
}

function createSocksConnect(proxyConfig, targetHost, targetPort) {
  return (clientInstance) => {
    const options = {
      proxy: { host: proxyConfig.host, port: proxyConfig.port, type: 5 },
      command: 'connect',
      destination: { host: targetHost, port: targetPort },
      timeout: 12000
    };
    if (proxyConfig.userId && proxyConfig.password) {
      options.proxy.userId = proxyConfig.userId;
      options.proxy.password = proxyConfig.password;
    }
    SocksClient.createConnection(options)
      .then((info) => {
        clientInstance.setSocket(info.socket);
        clientInstance.emit('connect');
      })
      .catch((err) => {
        try { clientInstance.emit('error', new Error(`SOCKS5 Authentication Failed: ${err.message}`)); } catch (e) {}
      });
  };
}

function isSystemMessage(message) {
  const msg = message.toLowerCase();
  const keywords = ['/register', '/login', 'registered', 'logged in', 'password', 'captcha', 'pin'];
  return keywords.some(k => msg.includes(k));
}

function cleanUsername(rawName) {
  if (!rawName) return '';
  return rawName.replace(/§[0-9a-fk-or]/gi, '').replace(/\[.*?\]/g, '').replace(/►/g, '').trim().toLowerCase();
}

function isStaff(username) {
  const cleanName = cleanUsername(username);
  if (!cleanName || cleanName === 'gamster' || cleanName.includes('system')) return false;
  return STAFF_LIST.has(cleanName);
}

function containsStaffName(text) {
  const cleanText = cleanUsername(text);
  for (const staff of STAFF_LIST) {
    if (cleanText.includes(staff)) return staff;
  }
  return null;
}

// ==========================================
// SLASH COMMAND REGISTRATION
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName('spawn')
    .setDescription('⚡ Launch high-speed Minecraft AFK bot cluster')
    .addStringOption(opt => opt.setName('server').setDescription('IP:PORT (e.g. play.gamster.org:25565)').setRequired(true))
    .addStringOption(opt => opt.setName('user').setDescription('Usernames separated by commas').setRequired(true))
    .addStringOption(opt => opt.setName('password').setDescription('Authentication password').setRequired(false))
    .addStringOption(opt => opt.setName('proxy').setDescription('SOCKS5 Proxy (host:port:user:pass)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setproxy')
    .setDescription('🔄 Revive a disconnected bot with a fresh proxy')
    .addStringOption(opt => opt.setName('username').setDescription('Bot username').setRequired(true))
    .addStringOption(opt => opt.setName('proxy').setDescription('New SOCKS5 proxy').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('🛑 Safely terminate active bot instance(s)')
    .addStringOption(opt => opt.setName('target').setDescription('Username or "all"').setRequired(true)),

  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('💬 Dispatch messages or commands through active bots')
    .addStringOption(opt => opt.setName('target').setDescription('Username or "all"').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message or command to send').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('📊 Interactive Cyber Dashboard with Live Metrics'),

  new SlashCommandBuilder()
    .setName('staff')
    .setDescription('🛡️ High-security staff detection radar settings')
    .addSubcommand(sub => sub.setName('add').setDescription('Add staff username').addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove staff username').addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true)))
    .addSubcommand(sub => sub.setName('view').setDescription('View current monitored staff list'))
].map(cmd => cmd.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', async () => {
  console.log(`[DISCORD] Authenticated as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[DISCORD] Slash commands successfully synchronized.');
  } catch (error) {
    console.error('[DISCORD ERROR]', error);
  }
});

// ==========================================
// MINECRAFT BOT CONNECTION MANAGEMENT
// ==========================================
function connectBot(session) {
  if (session.isOnline || session.isManualStop) return;

  session.status = 'Connecting...';
  const proxyConfig = parseProxy(session.proxyInput);

  const botOpts = {
    host: session.host,
    port: session.port,
    username: session.username,
    version: '1.8.9',
    brand: 'Lunar Client'
  };

  if (proxyConfig) botOpts.connect = createSocksConnect(proxyConfig, session.host, session.port);

  let bot;
  try {
    bot = mineflayer.createBot(botOpts);
  } catch (e) {
    session.status = `Creation Error: ${e.message}`;
    return;
  }

  session.bot = bot;
  let isAuthSent = false;

  bot.once('spawn', () => {
    session.isOnline = true;
    session.status = 'Online';
    session.sessionStartTime = Date.now();

    for (const uuid in bot.players) {
      const player = bot.players[uuid];
      if (player && player.username && isStaff(player.username)) {
        triggerStaffEvasion(session, player.username);
        return;
      }
    }

    const targetUptimeMs = (20 * 60 * 60 * 1000) + (1 * 60 * 1000); // 20 hours and 1 minute
    const remainingTimeForAFK = targetUptimeMs - session.accumulatedTime;

    if (session.afkTimer) clearTimeout(session.afkTimer);

    if (remainingTimeForAFK > 0) {
      session.afkTimer = setTimeout(() => {
        if (session.isOnline && session.bot) {
          const pass = session.password || 'N/A';
          const fileBuffer = Buffer.from(`${session.username}:${pass}`, 'utf-8');
          const attachment = new AttachmentBuilder(fileBuffer, { name: `${session.username}.txt` });

          if (alertChannel) {
            const completeEmbed = new EmbedBuilder()
              .setTitle('🎯 AFK GOAL COMPLETED')
              .setColor(0x00FF88)
              .setDescription(`\`\`\`ansi\n\u001b[1;32m[+] SUCCESSFUL 20H 01M AFK SESSION COMPLETED\u001b[0m\n\u001b[1;36mUsername :\u001b[0m ${session.username}\n\u001b[1;36mPassword :\u001b[0m ${pass}\n\`\`\``)
              .setFooter({ text: '⚡ Session ended automatically. Output file attached below.' });

            alertChannel.send({ 
              embeds: [completeEmbed], 
              files: [attachment] 
            }).catch(() => {});
          }

          session.isManualStop = true;
          activeBots.delete(session.username);
          session.bot.quit();
        }
      }, remainingTimeForAFK);
    }
  });

  bot.on('playerJoined', (player) => {
    if (player && player.username && isStaff(player.username)) {
      triggerStaffEvasion(session, player.username);
    }
  });

  bot.on('message', (jsonMsg) => {
    const rawMsg = jsonMsg.toString().trim();
    if (!rawMsg) return;

    const detectedStaff = containsStaffName(rawMsg);
    if (detectedStaff) {
      triggerStaffEvasion(session, detectedStaff);
      return;
    }

    if (isSystemMessage(rawMsg)) {
      if (session.password && !isAuthSent) {
        const lowerMsg = rawMsg.toLowerCase();
        if (lowerMsg.includes('/register')) {
          isAuthSent = true;
          session.status = 'Authenticating (/register)...';
          setTimeout(() => {
            if (session.bot) {
              session.bot.chat(`/register ${session.password}${session.password}`);
            }
          }, 1500);
        } else if (lowerMsg.includes('/login')) {
          isAuthSent = true;
          session.status = 'Authenticating (/login)...';
          setTimeout(() => {
            if (session.bot) {
              session.bot.chat(`/login ${session.password}`);
            }
          }, 1500);
        }
      }
    }
  });

  bot.on('end', () => {
    if (session.isOnline && session.sessionStartTime) {
      session.accumulatedTime += (Date.now() - session.sessionStartTime);
    }
    session.isOnline = false;
    if (session.afkTimer) clearTimeout(session.afkTimer);

    if (session.isManualStop) return;

    if (session.status.includes('Evading Staff')) {
      setTimeout(() => {
        if (activeBots.has(session.username) && !session.isManualStop) {
          connectBot(session);
        }
      }, 30000);
      return;
    }

    session.status = 'Reconnecting...';
    setTimeout(() => {
      if (activeBots.has(session.username) && !session.isManualStop) {
        connectBot(session);
      }
    }, 10000);
  });

  bot.on('error', (err) => {
    session.status = `Error: ${err.message}`;
    const errMsg = err.message.toLowerCase();
    
    if (
      errMsg.includes('socks5') || 
      errMsg.includes('auth') || 
      errMsg.includes('authentication') ||
      errMsg.includes('econnrefused') || 
      errMsg.includes('etimedout')
    ) {
      if (session.isManualStop) return;
      session.isManualStop = true;
      if (session.bot) {
        try { session.bot.quit(); } catch (e) {}
      }
      handleProxyFailure(session);
    }
  });
}

function triggerStaffEvasion(session, staffUsername) {
  session.status = `Evading Staff (${staffUsername})`;
  if (session.bot) {
    session.bot.quit();
  }
}

function handleProxyFailure(session) {
  if (session.isManualStop) return;
  session.isManualStop = true;
  session.status = 'Proxy Down!';

  let uptimeMs = session.accumulatedTime;
  if (session.isOnline && session.sessionStartTime) {
    uptimeMs += (Date.now() - session.sessionStartTime);
  }
  const formattedUptime = formatUptime(uptimeMs);
  const pass = session.password || 'N/A';

  if (alertChannel) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('⚠️ SYSTEM ALERT: PROXY DOWN')
      .setColor(0xFF0033)
      .setDescription(`\`\`\`ansi\n\u001b[1;31m[!] CONNECTION FAILURE DETECTED\u001b[0m\n\u001b[1;33m----------------------------------------\u001b[0m\n\u001b[1;37mAccount :\u001b[0m ${session.username}\n\u001b[1;37mPassword:\u001b[0m ${pass}\n\u001b[1;37mUptime  :\u001b[0m ${formattedUptime}\n\u001b[1;33m----------------------------------------\u001b[0m\n\u001b[1;31mStatus  :\u001b[0m PROXY DOWN & REMOVED\n\`\`\``)
      .setFooter({ text: `⚡ Execute /setproxy ${session.username} <new_proxy> to revive` });

    alertChannel.send({ embeds: [errorEmbed] }).catch(() => {});
  }

  activeBots.delete(session.username);
}

// ==========================================
// INTERACTION HANDLER
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;
  alertChannel = interaction.channel;

  if (commandName === 'spawn') {
    const server = options.getString('server');
    const userStr = options.getString('user');
    const password = options.getString('password') || null;
    const proxy = options.getString('proxy') || null;

    const [host, rawPort] = server.split(':');
    const port = parseInt(rawPort, 10) || 25565;
    const usernames = userStr.split(',').map(u => u.trim());

    const spawnEmbed = new EmbedBuilder()
      .setTitle('🚀 BOT CLUSTER DEPLOYED')
      .setColor(0x00E5FF)
      .setDescription(`\`\`\`ansi\n\u001b[1;36m[SYSTEM INITIALIZING DEPLOYMENT]\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;37mTarget Server :\u001b[0m ${host}:${port}\n\u001b[1;37mBot Count     :\u001b[0m ${usernames.length}\n\u001b[1;37mProxy Mode    :\u001b[0m ${proxy ? 'SOCKS5 Enabled' : 'Direct Direct'}\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;32mActive Queue  :\u001b[0m ${usernames.join(', ')}\n\`\`\``)
      .setFooter({ text: '⚡ Launch sequence active. Staggering connection interval (3s).' });

    await interaction.reply({ embeds: [spawnEmbed] });

    usernames.forEach((username, index) => {
      setTimeout(() => {
        let session = activeBots.get(username);
        if (!session) {
          session = {
            username, password, proxyInput: proxy, host, port,
            status: 'Initializing', isOnline: false, isManualStop: false,
            accumulatedTime: 0, sessionStartTime: null, bot: null, afkTimer: null
          };
          activeBots.set(username, session);
        } else {
          session.isManualStop = false;
        }
        connectBot(session);
      }, index * 3000);
    });
  }

  else if (commandName === 'setproxy') {
    const username = options.getString('username').trim();
    const newProxy = options.getString('proxy').trim();

    let session = activeBots.get(username);
    if (!session) {
      session = {
        username, password: '', proxyInput: newProxy, host: 'play.gamster.org', port: 25565,
        status: 'Reviving...', isOnline: false, isManualStop: false,
        accumulatedTime: 0, sessionStartTime: null, bot: null, afkTimer: null
      };
      activeBots.set(username, session);
    } else {
      session.proxyInput = newProxy;
      session.isManualStop = false;
      session.status = 'Reviving...';
    }

    if (session.bot) {
      session.bot.quit();
    } else {
      connectBot(session);
    }

    const reviveEmbed = new EmbedBuilder()
      .setTitle('🔄 PROXY REVIVAL INITIATED')
      .setColor(0x00FF66)
      .setDescription(`\`\`\`ansi\n\u001b[1;32m[+] RECONNECTING INSTANCE WITH FRESH PROXY\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;37mTarget Bot :\u001b[0m ${username}\n\u001b[1;37mNew Proxy  :\u001b[0m ${newProxy}\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;36mStatus     :\u001b[0m Re-added to dashboard active loop\n\`\`\``)
      .setFooter({ text: '⚡ Session re-initialized.' });

    return interaction.reply({ embeds: [reviveEmbed] });
  }

  else if (commandName === 'status') {
    if (activeBots.size === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('📊 SYSTEM DASHBOARD')
        .setColor(0xFF3366)
        .setDescription(`\`\`\`ansi\n\u001b[1;31m[!] NO ACTIVE BOTS FOUND IN MEMORY\u001b[0m\n\nUse \u001b[1;36m/spawn\u001b[0m to deploy a new bot cluster.\n\`\`\``);
      return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    const botSessions = Array.from(activeBots.values());
    let currentIndex = 0;

    const generateEmbed = (index) => {
      const session = botSessions[index];
      let uptimeMs = session.accumulatedTime;
      if (session.isOnline && session.sessionStartTime) {
        uptimeMs += (Date.now() - session.sessionStartTime);
      }

      let coords = 'N/A';
      if (session.isOnline && session.bot?.entity?.position) {
        const pos = session.bot.entity.position;
        coords = `X: ${Math.round(pos.x)} | Y: ${Math.round(pos.y)} \vert{} Z:${Math.round(pos.z)}`;
      }

      const ping = session.isOnline && session.bot ? (session.bot.player?.ping || session.bot._client?.latency || 0) : 0;
      const headUrl = `https://mc-heads.net/avatar/${session.username}/100`;

      let statusBadge = '🔴 Offline';
      if (session.isOnline) statusBadge = '🟢 Online';
      else if (session.status.includes('Connecting')) statusBadge = '🟡 Connecting...';
      else if (session.status.includes('Evading')) statusBadge = '🛡️ Evading Staff';

      return new EmbedBuilder()
        .setColor(session.isOnline ? 0x00FFBB : 0xFF9900)
        .setAuthor({ name: `>  ${toCoolFont(session.username).toUpperCase()}  [${statusBadge}]`, iconURL: headUrl })
        .setThumbnail(headUrl)
        .addFields(
          { name: '⚡ STATUS', value: `\`\`\`${toCoolFont(session.status)}\`\`\``, inline: true },
          { name: '⏱️ UPTIME', value: `\`\`\`${formatUptime(uptimeMs)}\`\`\``, inline: true },
          { name: '📡 LATENCY', value: `\`\`\`${ping} ms\`\`\``, inline: true },
          { name: '📍 COORDINATES', value: `\`\`\`${coords}\`\`\``, inline: false },
          { name: '🎯 20H PROGRESS', value: `\`\`\`${makeProgressBar(uptimeMs)}\`\`\``, inline: false }
        )
        .setFooter({ text: `⚡ Cyber Dashboard • Instance ${index + 1} of${botSessions.length}` });
    };

    const generateButtons = (index, total) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('status_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId('status_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === total - 1)
      );
    };

    const initialEmbed = generateEmbed(currentIndex);
    const initialRow = generateButtons(currentIndex, botSessions.length);

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: botSessions.length > 1 ? [initialRow] : [],
      fetchReply: true
    });

    if (botSessions.length <= 1) return;

    const collector = response.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ Access Denied: You cannot control this menu.', ephemeral: true });
      }

      if (i.customId === 'status_prev' && currentIndex > 0) currentIndex--;
      else if (i.customId === 'status_next' && currentIndex < botSessions.length - 1) currentIndex++;

      await i.update({
        embeds: [generateEmbed(currentIndex)],
        components: [generateButtons(currentIndex, botSessions.length)]
      });
    });

    collector.on('end', () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('status_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('status_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  }

  else if (commandName === 'stop') {
    const target = options.getString('target');

    if (target.toLowerCase() === 'all') {
      activeBots.forEach(s => {
        s.isManualStop = true;
        if (s.afkTimer) clearTimeout(s.afkTimer);
        if (s.bot) s.bot.quit();
      });
      activeBots.clear();

      const stopAllEmbed = new EmbedBuilder()
        .setTitle('🛑 SYSTEM SHUTDOWN')
        .setColor(0xFF0055)
        .setDescription(`\`\`\`ansi\n\u001b[1;31m[!] TERMINATING ALL ACTIVE BOT INSTANCES\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\nAll connections closed. Memory cleared.\n\`\`\``);

      return interaction.reply({ embeds: [stopAllEmbed] });
    } else {
      const session = activeBots.get(target);
      if (session) {
        session.isManualStop = true;
        if (session.afkTimer) clearTimeout(session.afkTimer);
        if (session.bot) session.bot.quit();
        activeBots.delete(target);

        const stopEmbed = new EmbedBuilder()
          .setTitle('🛑 INSTANCE TERMINATED')
          .setColor(0xFF0055)
          .setDescription(`\`\`\`ansi\n\u001b[1;31m[!] BOT DISCONNECTED SUCCESSFULLY\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;37mTarget Instance :\u001b[0m ${target}\n\`\`\``);

        return interaction.reply({ embeds: [stopEmbed] });
      }

      return interaction.reply({ content: `❌ **Error:** Instance \`${target}\` was not found.`, ephemeral: true });
    }
  }

  else if (commandName === 'chat') {
    const target = options.getString('target');
    const message = options.getString('message');

    if (target.toLowerCase() === 'all') {
      let count = 0;
      activeBots.forEach(s => {
        if (s.isOnline && s.bot) {
          s.bot.chat(message);
          count++;
        }
      });

      const chatAllEmbed = new EmbedBuilder()
        .setTitle('💬 BROADCAST TRANSMITTED')
        .setColor(0x00E5FF)
        .setDescription(`\`\`\`ansi\n\u001b[1;36m[+] BROADCAST DISPATCHED TO ALL BOTS\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;37mActive Receivers :\u001b[0m ${count} bots\n\u001b[1;37mPayload          :\u001b[0m ${message}\n\`\`\``);

      return interaction.reply({ embeds: [chatAllEmbed] });
    } else {
      const s = activeBots.get(target);
      if (s && s.isOnline && s.bot) {
        s.bot.chat(message);

        const chatEmbed = new EmbedBuilder()
          .setTitle('💬 PAYLOAD TRANSMITTED')
          .setColor(0x00E5FF)
          .setDescription(`\`\`\`ansi\n\u001b[1;36m[+] MESSAGE TRANSMITTED\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\n\u001b[1;37mTarget Bot :\u001b[0m ${target}\n\u001b[1;37mPayload    :\u001b[0m ${message}\n\`\`\``);

        return interaction.reply({ embeds: [chatEmbed] });
      }

      return interaction.reply({ content: `❌ **Error:** Bot \`${target}\` is currently offline.`, ephemeral: true });
    }
  }

  else if (commandName === 'staff') {
    const sub = options.getSubcommand();
    if (sub === 'view') {
      const listArray = Array.from(STAFF_LIST);
      const formattedList = listArray.length > 0 ? listArray.join(', ') : 'None';

      const staffEmbed = new EmbedBuilder()
        .setTitle('🛡️ RADAR: MONITORED STAFF LIST')
        .setColor(0xFFAA00)
        .setDescription(`\`\`\`ansi\n\u001b[1;33m[RADAR ACTIVE - ${STAFF_LIST.size} TARGETS MONITORED]\u001b[0m\n\u001b[1;30m----------------------------------------\u001b[0m\n${formattedList}\n\`\`\``)
        .setFooter({ text: '⚡ Auto-evasion will trigger on tablist scan or chat match.' });

      return interaction.reply({ embeds: [staffEmbed], ephemeral: true });
    }

    const targetUser = options.getString('username').trim().toLowerCase();

    if (sub === 'add') {
      STAFF_LIST.add(targetUser);
      const addEmbed = new EmbedBuilder()
        .setTitle('🛡️ RADAR UPDATED')
        .setColor(0x00FF66)
        .setDescription(`\`\`\`ansi\n\u001b[1;32m[+] TARGET ADDED TO MONITORING LIST\u001b[0m\n\u001b[1;37mUsername :\u001b[0m ${targetUser}\n\`\`\``);
      return interaction.reply({ embeds: [addEmbed], ephemeral: true });
    } else if (sub === 'remove') {
      STAFF_LIST.delete(targetUser);
      const removeEmbed = new EmbedBuilder()
        .setTitle('🛡️ RADAR UPDATED')
        .setColor(0xFF0055)
        .setDescription(`\`\`\`ansi\n\u001b[1;31m[-] TARGET REMOVED FROM MONITORING LIST\u001b[0m\n\u001b[1;37mUsername :\u001b[0m ${targetUser}\n\`\`\``);
      return interaction.reply({ embeds: [removeEmbed], ephemeral: true });
    }
  }
});

if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch(console.error);
} else {
  console.log('[DISCORD] Waiting for valid DISCORD_TOKEN via Environment Variable or Web Portal...');
}
