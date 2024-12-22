const Discord = require('discord.js');
const pkg = require('../../package.json');
const axios = require("axios");
const commandos = require('commandos');
const amqp = require('amqplib');
const _CONFIG = {
  message_queue: {
      queue_name: process.env.SCAN_QUEUE_NAME || 'jobs',
      queue_host: process.env.QUEUE_HOST || 'localhost',
      queue_username: process.env.QUEUE_USERNAME || 'guest',
      queue_password: process.env.QUEUE_PASSWORD || 'guest'
  },
  debug: process.env.DEBUG || false
};

const { SlashCommandBuilder } = require('discord.js');
const PRIVILEGED_USER_IDS = process.env.PRIVILEGED_USER_IDS||[];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('scan')
		.setDescription('Send a request to the scanners')
        .addStringOption(option => option.setName('range').setDescription('IP or range (eg- 192.168.0.0/16, or 192.168.0.1, or 192.168.0.1/32.. whatever works)'))
        .addStringOption(option => option.setName('ports').setDescription('The ports to scan (default 25565)')),
	execute: async (interaction) => {
    if(!PRIVILEGED_USER_IDS.match(new RegExp("[^\\s]" + interaction.user.id + "[\\s$]")))
    {
      return interaction.reply("You don't have permission to use this command.");
    }
    var replymsg = "Sending the request to scanners."
    var args = {
        range: interaction.options.getString('range'),
        ports: parseInt(interaction.options.getString('ports'))||25565,
    }
	}
};


var queue = App.config.message_queue.queue_name;

if(App.config.verbose) {
    console.log("Attempting connection to RabbitMQ server at " + App.config.message_queue.queue_host);
    console.log("Username:\t" + App.config.message_queue.queue_username);
    console.log("Queue:\t\t" + App.config.message_queue.queue_name);
}
amqplib.connect('amqp://' + App.config.message_queue.queue_username + ":" + App.config.message_queue.queue_password + "@" + App.config.message_queue.queue_host + "/", {}, function (err, conn) {
    if(App.config.verbose) {
        console.log("Connected to " + App.config.message_queue.queue_host);
    }
    if(err) {
        console.log(err);
        return process.exit(1);
    }
    conn.createChannel(function (err, ch) {
        ch.on('error', (error) => {
            console.log("An error occurred in the message queue:\n" + error);
        });
        ch.on('close', () => {
            console.log("Connection to queue has been closed. The application will now exit so that it can be restarted.");
            process.exit(1);
        });

        if (err) {
            console.log(err);
            return;
        }
        console.log('Connecting to queue: ' + queue);
        ch.sendToQueue("range-scan-queue", new Buffer.from(JSON.stringify(newMessage)), {}, function (err, ok) {
          if (err) { console.log(err); return; }
          console.log("Sent " + newMessage.servers.length + " hosts to the ping queue.");
        });
    });
});