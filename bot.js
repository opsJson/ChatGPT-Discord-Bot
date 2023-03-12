const DiscordToken = "discord-token";
const OpeanAIToken = "opeanai-token";
const ChannelID = "channel-id";
const MaxTokens = 2048;

const fetch = require("node-fetch");
const {Client, GatewayIntentBits} = require("discord.js");
const client = new Client({intents:[
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent
]});

client.on("messageCreate", async (message) => {
	if (message.channel.id != ChannelID) return;
	if (message.author.bot) return;
	
	interval = setInterval(() => {
		message.channel.sendTyping();
	}, 10000);
	message.channel.sendTyping();
	
	const messages = await message.channel.messages.fetch();
	const chat = [];
	let counter = 0;
	
	messages.forEach(message => {
		counter += message.content.length;

		if (counter > MaxTokens) return false;
		
		chat.push({
			role: message.author.id == client.user.id ? "assistant" : "user",
			content: message.content
		});
	});
	
	chat.reverse();
	
	fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${OpeanAIToken}`
		},
		body: JSON.stringify({
			model: "gpt-3.5-turbo",
			messages: chat
		})
	})
	.then(r => {
		if (r.status != 200) {
			clearInterval(interval);
			message.channel.send(r);
			return null;
		}
		return r.json();
	})
	.then(r => {
		if (!r) return;
		r = r.choices[0].message.content;
		r = r.match(/[\s\S]{1,2000}/g);
		
		clearInterval(interval);
		r.forEach(chunk => {
			message.channel.send(chunk);
		});
	})
	.catch(e => console.error(e));
});

client.login(DiscordToken);