require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Create bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Load permissions from the permissions.json file
const permissionsFilePath = path.join(__dirname, 'permissions.json');
let permissions = {};

// Check if the permissions file exists and load it
if (fs.existsSync(permissionsFilePath)) {
  permissions = JSON.parse(fs.readFileSync(permissionsFilePath, 'utf-8'));
} else {
  console.log('permissions.json not found! Please create it in the root directory.');
}

// Define the slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('giverole')
    .setDescription('Assign a specific role to a user')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The user to give a role to')
        .setRequired(true)
    )
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('The role to assign')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a specific role from a user')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true)
    )
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('The role to remove')
        .setRequired(true)
    )
].map(command => command.toJSON());

// Register slash commands with Discord API
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

async function registerCommands() {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Slash commands registered!");
  } catch (error) {
    console.error("Error registering commands: ", error);
  }
}

// Check if a member can give or remove a role based on the permissions in permissions.json
function hasPermissionToManageRole(member, role) {
  const roleId = role.id;

  // Check if member's role is allowed to manage the role
  for (const [giverRoleId, allowedRoles] of Object.entries(permissions.roles)) {
    if (member.roles.cache.has(giverRoleId) && allowedRoles.includes(roleId)) {
      return true;
    }
  }

  return false;
}

// Handle the interaction and role assignment or removal
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "giverole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    const member = await interaction.guild.members.fetch(user.id);
    const giver = interaction.member; // The member giving the role

    // Check if the giver has permission
    if (!hasPermissionToManageRole(giver, role)) {
      return interaction.reply({
        content: "You do not have permission to assign this role in the Solar Role Play community.",
        ephemeral: true
      });
    }

    // Assign the role
    try {
      await member.roles.add(role);
      await interaction.reply({
        content: `✅ Successfully gave ${role.name} to <@${user.id}> by Solar roleplay!`,
      });

      // Notify the person giving the role
      await giver.send(`✅ You have successfully given the ${role.name} role to <@${user.id}> by Solar roleplay.`);

      // Notify in the channel and ping the user
      await interaction.channel.send(`<@${user.id}>, you have received the ${role.name} role from Solar roleplay!`);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "❌ Failed to assign the role. Ensure my role is above the target role in the server settings.",
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === "removerole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    const member = await interaction.guild.members.fetch(user.id);
    const remover = interaction.member; // The member removing the role

    // Check if the remover has permission to remove the role
    if (!hasPermissionToManageRole(remover, role)) {
      return interaction.reply({
        content: "You do not have permission to remove this role in the Solar Role Play community.",
        ephemeral: true
      });
    }

    // Remove the role
    try {
      await member.roles.remove(role);
      await interaction.reply({
        content: `✅ Successfully removed ${role.name} from <@${user.id}> by Solar roleplay!`,
      });

      // Notify the person removing the role
      await remover.send(`✅ You have successfully removed the ${role.name} role from <@${user.id}> by Solar roleplay.`);

      // Notify in the channel and ping the user
      await interaction.channel.send(`<@${user.id}>, the ${role.name} role has been removed from you by Solar roleplay.`);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "❌ Failed to remove the role. Ensure my role is above the target role in the server settings.",
        ephemeral: true
      });
    }
  }
});

// Log the bot in and register commands
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.login(process.env.BOT_TOKEN);
