const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const DATA_FILE = "./tracked_users.json";
const DEFAULT_UPDATE_INTERVAL = 60000;

let serverTrackedUsers = {};
if (fs.existsSync(DATA_FILE)) {
    serverTrackedUsers = JSON.parse(fs.readFileSync(DATA_FILE));
}

const serverUpdateIntervals = {};

function saveTrackedUsers() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(serverTrackedUsers, null, 2));
}

async function getSteamStatus(steamId) {
    try {
        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;
        const { data } = await axios.get(url);
        const player = data.response.players[0];

        return {
            id: steamId,
            name: player.personaname,
            avatar: player.avatarfull,
            game: player.gameextrainfo || "Not playing anything",
        };
    } catch (error) {
        console.error(`Error fetching data for steamid ${steamId}:`, error);
        return null;
    }
}

let statusInterval;

function updateBotStatus() {
    const totalServers = client.guilds.cache.size;
    const totalTracked = Object.values(serverTrackedUsers)
        .reduce((sum, guild) => sum + (guild.users?.length || 0), 0);

    const statuses = [
        `👀 Tracking ${totalTracked} Steam profiles`,
        `🌍 Active in ${totalServers} servers`,
        `🕹️ Type /stalk to track a profile!`
    ];

    let i = 0;

    if (statusInterval) clearInterval(statusInterval);

    statusInterval = setInterval(() => {
        client.user.setActivity(statuses[i], { type: 3 });
        i = (i + 1) % statuses.length;
    }, 15000);
}


async function updateStatus(guildId) {
    const channel = client.channels.cache.get(serverTrackedUsers[guildId]?.channelId);
    if (!channel) return console.error(`Cannot find channel for guild ${guildId}`);

    const trackedUsers = serverTrackedUsers[guildId]?.users || [];
    const embeds = [];

    for (const steamId of trackedUsers) {
        const steamData = await getSteamStatus(steamId);
        if (!steamData) continue;

        const embed = new EmbedBuilder()
            .setTitle(`👤  ${steamData.name}`)
            .setThumbnail(steamData.avatar)
            .setImage(`https://steamcdn-a.akamaihd.net/steam/apps/${steamData.gameid}/header.jpg`)
            .addFields({ name: "Profile", value: `[Link](https://steamcommunity.com/profiles/${steamId})`, inline: false })
            .addFields({ name: "Currently Playing", value: steamData.game, inline: false })
            .addFields({ name: "\u200B", value: "[🔗 Add to Your Server]()", inline: false })
            .setColor(`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`)
            .setFooter({ text: `Last update — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });

        embeds.push(embed);
    }

    if (embeds.length === 0) {
        console.log(`✨ | No users tracked for guild ${guildId}`);
        return;
    }

    const messageId = serverTrackedUsers[guildId]?.messageId;
    if (messageId) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
            await msg.edit({ embeds });
            return;
        }
    }

    const sentMessage = await channel.send({ embeds });
    
    if (!serverTrackedUsers[guildId]) serverTrackedUsers[guildId] = {};
    serverTrackedUsers[guildId].messageId = sentMessage.id;
    saveTrackedUsers();
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ 
            content: "❌ | You do not have permission to use these commands (Manage Channels)",
            flags: 64
        });
    }

    const { commandName, options, guildId } = interaction;

    if (commandName === "stalk") {
        const steamId = options.getString("steamid");
        
        if (!serverTrackedUsers[guildId]) {
            serverTrackedUsers[guildId] = { 
                users: [], 
                channelId: interaction.channelId 
            };
        }

        if (!serverTrackedUsers[guildId].users.includes(steamId)) {
            serverTrackedUsers[guildId].users.push(steamId);
            saveTrackedUsers();
            
            await updateStatus(guildId);

            await interaction.reply({ 
                content: `✅ | Added Steam ID ${steamId} to tracked profiles`, 
                flags: 64
            });
        } else {
            await interaction.reply({ 
                content: `⚠️ | Steam ID ${steamId} is already being tracked`, 
                flags: 64
            });
        }
    } else if (commandName === "stopstalk") {
        const steamId = options.getString("steamid");
        
        if (serverTrackedUsers[guildId]?.users.includes(steamId)) {
            serverTrackedUsers[guildId].users = 
                serverTrackedUsers[guildId].users.filter(id => id !== steamId);
            saveTrackedUsers();
            await interaction.reply({ 
                content: `🗑️ | Removed Steam ID ${steamId} from tracked profiles`, 
                flags: 64
            });
        } else {
            await interaction.reply({ 
                content: `⚠️ | Steam ID ${steamId} is not being tracked`, 
                flags: 64
            });
        }
    } else if (commandName === "update") {
        const seconds = options.getInteger("seconds");

        if (seconds < 60 || seconds > 86400) {
            return interaction.reply({ 
                content: "⚠️ | The update interval must be between 60 and 86400 seconds.",
                flags: 64
            });
        }

        if (serverUpdateIntervals[guildId]) {
            clearInterval(serverUpdateIntervals[guildId]);
        }

        serverUpdateIntervals[guildId] = setInterval(() => {
            updateStatus(guildId);
        }, seconds * 1000);

        await interaction.reply({ 
            content: `✅ | Update interval set to ${seconds} seconds`, 
            flags: 64
        });
    }
});

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName("stalk")
            .setDescription("Add Steam ID (type 64) to track")
            .addStringOption(option => 
                option.setName("steamid")
                    .setDescription("Steam ID 64 of user")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        
        new SlashCommandBuilder()
            .setName("stopstalk")
            .setDescription("Remove Steam ID (type 64) from tracking")
            .addStringOption(option => 
                option.setName("steamid")
                    .setDescription("Steam ID 64 of user")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        
        new SlashCommandBuilder()
            .setName("update")
            .setDescription("Set update frequency for Steam status")
            .addIntegerOption(option => 
                option.setName("seconds")
                    .setDescription("Update interval in seconds")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    ];

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
        console.log("Registering slash commands...");
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("✅ | Slash commands registered!");
    } catch (error) {
        console.error("❌ | Error registering commands:", error);
    }
}

client.once("ready", async () => {
    console.log(`✅`);
    updateBotStatus();
    await registerCommands();

    for (const guildId in serverTrackedUsers) {
        updateStatus(guildId);
        
        if (!serverUpdateIntervals[guildId]) {
            serverUpdateIntervals[guildId] = setInterval(() => {
                updateStatus(guildId);
            }, DEFAULT_UPDATE_INTERVAL);
        }
    }
});

client.login(process.env.TOKEN);