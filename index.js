require('dotenv').config();  // Load environment variables

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.TOKEN;  // Get token from .env file
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;  // Get log channel ID from .env file

const permissionsFilePath = path.join(__dirname, 'permissions.json');
let rolePermissions = JSON.parse(fs.readFileSync(permissionsFilePath, 'utf-8')).roles;

// Define the /giverole and /createrole commands
const commands = [
  new SlashCommandBuilder()
    .setName('giverole')
    .setDescription('Give a user a role')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to give the role to')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to give')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('createrole')
    .setDescription('Create a new role')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the role')
        .setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Check if a member has permission to give a role
function hasPermission(giver, roleId) {
  const giverRoleIds = giver.roles.cache.map(role => role.id);
  return giverRoleIds.some(giverRoleId =>
    rolePermissions[giverRoleId]?.includes(roleId) || rolePermissions[giverRoleId]?.includes("ALL_ROLES")
  );
}

// Log denied access
async function logDeniedAccess(giver, role, interaction) {
  const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel) return;

  const userTag = `${giver.user.username}#${giver.user.discriminator}`;
  const logMessage = `❌ **Permission Denied**\nUser: ${userTag} (${giver.id})\nTried to give/create role: <@&${role.id || 'N/A'}> (${role.name || role})`;

  logChannel.send(logMessage).catch(error => console.error("Failed to log denied access:", error));
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;

  if (interaction.commandName === 'giverole') {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    if (!hasPermission(member, role.id)) {
      await interaction.reply({ content: '❌ You don’t have permission to give this role. This action has been logged.', ephemeral: true });
      await logDeniedAccess(member, role, interaction);
      return;
    }

    const targetMember = await interaction.guild.members.fetch(user.id);
    await targetMember.roles.add(role);
    await interaction.reply({ content: `✅ Role <@&${role.id}> has been given to ${user.tag}`, ephemeral: true });
  }

  if (interaction.commandName === 'createrole') {
    const roleName = interaction.options.getString('name');

    const hasCreatePermission = Object.entries(rolePermissions).some(([roleId, allowed]) => {
      return member.roles.cache.has(roleId) && (allowed.includes('ALL_ROLES'));
    });

    if (!hasCreatePermission) {
      await interaction.reply({ content: '❌ You don’t have permission to create roles. This action has been logged.', ephemeral: true });
      await logDeniedAccess(member, { name: roleName }, interaction);
      return;
    }

    const newRole = await interaction.guild.roles.create({
      name: roleName,
      reason: `Created by ${member.user.tag} via /createrole`
    });

    await interaction.reply({ content: `✅ Role **${newRole.name}** created successfully.`, ephemeral: true });
  }
});

client.login(TOKEN);
