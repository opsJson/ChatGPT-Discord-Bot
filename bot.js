const {Client, GatewayIntentBits, ThreadChannel} = require("discord.js");
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
		description: "Seta o playground",
		options: [{
			name: "id",
			description: "Channel ID",
			type: 3,
			required: true
		}]
	});
	client.application.commands.create({
		name: "closeall",
		description: "Fecha todas as threads"
	});
	console.log("ChatGPT Bot online!");
});

client.on("interactionCreate", async (interaction) => {
	if (interaction.commandName == "channel") {
		const channelID = interaction.options.getString("id").trim();
		const channel = await client.channels.cache.get(channelID);
		
		if (channel) {
			ChatGPTChannelID = channelID;
			interaction.reply({
				content: `Canal playground setado: <#${ChatGPTChannelID}>`,
				ephemeral: true
			});
		}
		else {
			interaction.reply({
				content: `Canal não encontrado: **${channelID}**`,
				ephemeral: true
			});
		}
	}
	else if (interaction.commandName == "closeall") {
		if (!ChatGPTChannelID) {
			interaction.reply({
				content: "Canal playground ainda não foi setado!",
				ephemeral: true
			});
		}
		if (interaction.channel.id != ChatGPTChannelID) {
			interaction.reply({
				content: `Você só pode usar esse comando aqui: <#${ChatGPTChannelID}>`,
				ephemeral: true
			});
			return;
		}
		
		interaction.reply({
			content: "Deletando todas as threads...",
			ephemeral: true
		});
		
		const fetched = await interaction.channel.threads.fetch();
		fetched.threads.forEach(thread => {
			if (thread.parentId != ChatGPTChannelID) return;
			try {
				thread.delete();
			}
			catch (e) {
				console.error(e);
			}
		});
	}
});

client.on("messageCreate", async (message) => {
	if (!ChatGPTChannelID) return;
	if (message.author.bot) return;
	if (message.content.startsWith("!")) return;
	if (message.channel.parentId != ChatGPTChannelID
	 && message.channel.id != ChatGPTChannelID) return;
	
	let thread;
	
	if (message.channel instanceof ThreadChannel) {
		thread = message.channel;
	}
	else {
		thread = await message.startThread({
			name: message.content.slice(0, 22)
		});
	}
	
	const messages = await thread.messages.fetch();
	const chat = [];
	let counter = 0;
	
	messages.forEach(message => {
		counter += message.content.length;

		if (counter > MaxChars) return false;
		if (message.content.length == 0) return false;
		if (message.content.startsWith("!")) return false;
		
		chat.push({
			role: message.author.id == client.user.id ? "assistant" : "user",
			content: message.content
		});
	});
	
	const StarterMessage = await thread.fetchStarterMessage();
	chat.push({
		role: "user",
		content: StarterMessage.content
	});
	
	if (chat.length > 1) chat.reverse();
	
	const interval = setInterval(() => thread.sendTyping(), 5000);
	thread.sendTyping();
	console.log(chat);
	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${OpenAIToken}`
			},
			body: JSON.stringify({
				model: "gpt-3.5-turbo",
				messages: chat
			})
		});
		
		if (response.status != 200) {
			thread.send("Erro interno: API retornou status code diferente de 200.");
			return;
		}
		
		let r = await response.json();
		r = r.choices[0].message.content;
		r = r.match(/[\s\S]{1,2000}/g);
		
		clearInterval(interval);
		r.forEach(chunk => {
			thread.send(chunk);
		});
	}
	catch(e) {
		thread.send("Erro interno: API lançou alguma excessão.");
		console.log(e);
	}
	
	clearInterval(interval);
});

client.login(DiscordToken);