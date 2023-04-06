const {Client, GatewayIntentBits} = require("discord.js");
const fetch = require("node-fetch");

const client = new Client({intents:[
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent
]});
const DiscordToken = "discord-token";
const MaxChars = 8200;

let OpenAIToken;
let ChatGPTParentID;

client.on("ready", () => {
	client.application.commands.create({
		name: "config",
		description: "Sets OpenAI token and playground category ID",
		options: [
		{
			name: "token",
			description: "OpenAI token",
			type: 3
		},
		{
			name: "id",
			description: "Playground category ID",
			type: 3			
		}]
	});
	console.log("ChatGPT Bot online!");
});

client.on("interactionCreate", async (interaction) => {
	OpenAIToken = interaction.options.getString("token")?.trim() || OpenAIToken;
	ChatGPTParentID = interaction.options.getString("id")?.trim() || ChatGPTParentID;
	
	interaction.reply({
		content: "The new settings have been saved.",
		ephemeral: true
	});
});

client.on("messageCreate", async (message) => {
	if (message.author.bot) return;
	if (!message.channel.parent) return;
	if (message.content.startsWith("!")) return;
	if (message.channel.parent != ChatGPTParentID) return;
	
	const messages = await message.channel.messages.fetch();
	const chat = [];
	let counter = 0;
	
	messages.forEach(message => {
		counter += message.content.length;

		if (counter > MaxChars) return;
		if (message.content.length == 0) return;
		if (message.content.startsWith("!")) return;
		
		chat.push({
			role: message.author.id == client.user.id ? "assistant" : "user",
			content: message.content
		});
	});
	
	if (chat.length > 1) chat.reverse();
	
	const interval = setInterval(() => message.channel.sendTyping(), 5000);
	message.channel.sendTyping();
	
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
			throw "Erro interno: API retornou status code diferente de 200.";
		}
		
		let r = await response.json();
		r = r.choices[0].message.content;
		r = r.match(/[\s\S]{1,2000}/g);
		
		clearInterval(interval);
		r.forEach(chunk => {
			message.channel.send(chunk);
		});
	}
	catch(e) {
		clearInterval(interval); 
		message.channel.send("Erro interno!");
	}
});

client.login(DiscordToken);