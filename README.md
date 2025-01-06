# Welcome
This used to be my personal private source code. Please forgive the lack of configuration options, comments in the code, and documentation as I never intended for this code to be published.
However, since I have decided to publish this source, I am placing it under the GNU AGPLv3 license to ensure that any modifications to the source are also made available to everyone.

With all of that being said, this source code is provided as-is for educational purposes, and I assume no liability for what you do with it. You can read more about BBCrawler in [my blog post](https://rob.cat/projects/minecraft/2024/12/25/bbcrawler-minecraft-server-scanner.html).

## Getting Started
**This guide assumes:**
- That you have a dedicated or virtual private server (VPS) with at least 2 CPU cores and 8GB of memory.
- That you have a working knowledge of a Linux based operating system.
- That you have a basic knowledge of docker/docker compose.

### Install docker compose
**Ubuntu/Debian-like:**
```bash
sudo apt install docker docker-compose
```

**RHEL/Fedora/CentOS:**
```bash
sudo dnf install docker docker-compose
```

### Configure BBCrawler
The configuration should be fairly self-explanatory. Use `example.env` as a reference for your `production.env` file.

Once you are happy with the configuration then you can start the application by running `docker-compose up` or `docker-compose up -d` to run it in the background.

If you are running the scanner separately from the other services then be sure to expose RabbitMQ in the docker-compose file for the other services so that the scanning servers can connect to the message queue.

## Getting Help
Please feel free to join the [Break Blocks Club Discord](https://discord.gg/3RUjaRzdKv) for support.

### Speaking of support
It would be really super awesome of you if you could please support the development of this project through [Patreon](patreon.com/BreakBlocks). It only takes a second of your time to be a real skibidi rizzler.