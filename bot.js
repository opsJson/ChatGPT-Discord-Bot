const {Client, GatewayIntentBits} = require("discord.js");
const fetch = require("node-fetch");

const client = new Client({intents:[
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent
]});

const DiscordToken = "discord-token";
const OpenAIToken = "openai-token";
const MaxChars = 8200;
let ChatGPTChannelID;

client.on("ready", () => {
	client.application.commands.create({
		name: "channel",
		description: "Set bot channel",
		options: [{
			name: "id",
			description: "Channel ID",
			type: 3,
			required: true
		}]
	});
	console.log("ChatGPT Bot online!");
});

client.on("interactionCreate", async (interaction) => {
	const channelID = interaction.options.getString("id").trim();
	const channel = await client.channels.cache.get(channelID);
	
	if (channel) {
		ChatGPTChannelID = channelID;
		interaction.reply({
			content: `Now listening in <#${channelID}>`,
			ephemeral: true
		});
	}
	else {
		interaction.reply({
			content: `Could not find channel **${channelID}**`,
			ephemeral: true
		});
	}
});

client.on("messageCreate", async (message) => {
	if (message.author.bot) return;
	if (message.channel.id != ChatGPTChannelID) return;
	
	const messages = await message.channel.messages.fetch();
	const chat = [];
	let counter = 0;
	
	messages.forEach(message => {
		counter += message.content.length;

		if (counter > MaxChars) return false;
		
		chat.push({
			role: message.author.id == client.user.id ? "assistant" : "user",
			content: message.content
		});
	});
	
	chat.reverse();
	
	message.channel.sendTyping();
	
	fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${OpenAIToken}`
		},
		body: JSON.stringify({
			model: "gpt-3.5-turbo",
			messages: chat
		})
	})
	.then(r => {
		if (r.status != 200) {
			message.channel.send(r);
			return null;
		}
		return r.json();
	})
	.then(r => {
		if (!r) return;
		r = r.choices[0].message.content;
		r = r.match(/[\s\S]{1,2000}/g);
		
		r.forEach(chunk => {
			message.channel.send(chunk);
		});
	})
	.catch(e => {
		e = e.match(/[\s\S]{1,2000}/g);
		
		e.forEach(chunk => {
			message.channel.send(chunk);
		});
	});
});

client.login(DiscordToken);