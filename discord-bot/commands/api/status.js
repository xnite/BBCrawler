const pkg = require('../../package.json');
const axios = require("axios");
const commandos = require('commandos');
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Gets the status of the API'),
	execute: async (interaction) => {
     console.log("Getting the API status at request of " + interaction.user.username);
     interaction.reply("Getting API status...");
      axios.get((process.env["API_URL"]||"http://api:8080")).then((response) => {
        let status = response.data;
        axios.get((process.env["API_URL"]||"http://api:8080") + "/api/v0.1/servers/regions").then((response2) => {
          let regions = response2.data;
          let messageString = "The API is currently online. It is running " + status.name + " version " + status.version + "\nI am running " + pkg.name + " version " + pkg.version + "\nThere are " + regions.total_servers + " active block game servers across " + regions.unique_regions + " continents in my database.\n**Region Stats:**";
          regions.regions.forEach((region) => {
            messageString += "\n" + region.num_servers + " servers in " + region.region;
          })
          return interaction.followUp(messageString);
          

        }).catch((error2) => {
          console.log(error2);
          return interaction.followUp("The API experienced an error during your request. Please try again later!");
        })

      }).catch((error) => {
        console.log(error);
        return interaction.followUp("The API currently appears to be offline! If you are the admin then check the console for details of this error.");
      })
	},
};