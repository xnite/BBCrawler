const Discord = require('discord.js');
const pkg = require('../../package.json');
const axios = require("axios");
const commandos = require('commandos');
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription('Search the database for servers.')
        .addStringOption(option => option.setName('asn').setDescription('Search by ASN.'))
        .addStringOption(option => option.setName('country').setDescription('Search by country.'))
        .addStringOption(option => option.setName('country_code').setDescription('Search by country code.'))
        .addStringOption(option => option.setName('org').setDescription('Search by organization.'))
        .addStringOption(option => option.setName('region').setDescription('Search by region.'))
        .addStringOption(option => option.setName('version').setDescription('Search by version.'))
        .addBooleanOption(option => option.setName('extended').setDescription('Show extended information.'))
        .addStringOption(option => option.setName('motd').setDescription('Search within MOTD.')),
	execute: async (interaction) => {
    if(interaction.client.guilds.cache.filter((guild) => {
      return guild.members.cache.has(interaction.user.id);
    }) == false) {
      return interaction.reply("You don't have permission to use this command.");
    }
    var replymsg = "Searching the database for servers"
    var args = {
        asn: interaction.options.getString('asn'),
        country: interaction.options.getString('country'),
        country_code: interaction.options.getString('country_code'),
        org: interaction.options.getString('org'),
        region: interaction.options.getString('region'),
        version: interaction.options.getString('version'),
        motd: interaction.options.getString('motd'),
        extended: interaction.options.getBoolean('extended')
    }
     let extended = false;
     let url = (process.env["API_URL"]||"http://api:8080") + "/api/v0.1/servers/find?sort=updated&limit=10&relativeTime=1";
     
     if(args.country) { 
      if(args.country.length == 2) {
        url += "&country_code="+ encodeURIComponent(args.country)
      } else {
        url += "&country="+ encodeURIComponent(args.country)
      }
      replymsg += " in " + args.country;
    }
     if(args.country_code) { url += "&country_code=" + encodeURIComponent(args.country_code); replymsg += " in " + args.country_code; }
     if(args.region) { url += "&region=" + encodeURIComponent(args.region); replymsg += " in " + args.region; }

     if(args.org) { url += "&org=" + encodeURIComponent(args.org); replymsg += " hosted by " }
     if(args.asn) { url += "&asn="+ encodeURIComponent(args.asn.replace(/^ASN?/, '')); replymsg += " hosted by AS" + args.asn.replace(/^ASN?/, ''); }

     if(args.version) { url += "&version=" + encodeURIComponent(args.version); replymsg += " running version " + args.version; }

     if(args.motd) { url += "&motd=" + encodeURIComponent(args.motd); replymsg += " with MOTD containing " + args.motd; }

     if(args.extended) { extended = true; }

     interaction.reply(replymsg);
     var embed = new Discord.EmbedBuilder()
       .setTitle("Server Search Results");
     axios.get(url).then((response) => {
       let data = response.data;
       let result_summary = "Showing " + data.displayed + " of " + data.total + " servers. " + data.filtered + " are filtered.";
       embed.setDescription(result_summary);
       let i = 1;
       //keep each server on it's own line in embed. Should display only the server connection info, version, players online/limit, last ping, and ASN/ISP info. Use a flag emoji next to the server name to indicate the country.
       data.results.forEach((server) => {
        var fieldValue = "**Version:** " + server.version;
        if(server.motd_stripped) {
          fieldValue += "\n**MOTD:** " + server.motd_stripped.substring(0, 72);
        }
        embed.addFields([
            { name: "["+ server.country_code + "|" + server.region + "][" + server.players_online + "/" + server.players_limit + "][" + server.last_ping + "]" + server.address + ":" + server.port, value: fieldValue, inline: false }
        ]);
         i++;
       })
        // Add a button to view the next page of results if there are more than 10 results.
        if(data.total > 10) {
          embed.setFooter({text: "Page 1 of " + Math.ceil(data.total/10)});
          interaction.followUp({ embeds: [embed]});
        } else {
          interaction.followUp({ embeds: [embed] });
        }
     }).catch((error) => {
       console.log(error);
       return interaction.followUp("The request failed. Please try again later.")
     });
	},
};