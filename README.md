# Welcome
This used to be my personal private source code. Please forgive the lack of configuration options, comments in the code, and documentation as I never intended for this code to be published.
However, since I have decided to publish this source, I am placing it under the GNU AGPLv3 license to ensure that any modifications to the source are also made available to everyone.

With all of that being said, this source code is provided as-is for educational purposes, and I assume no liability for what you do with it.

## Getting Started
Before running this application, you will need to have Docker and Docker Compose installed to a VPS or dedicated server.

**This guide assumes:**
- That you have a working knowledge of a Linux based operating system.
- That you have a basic knowledge of docker/docker compose.

**Ubuntu/Debian-like:**
```bash
sudo apt install docker docker-compose
```

**RHEL/Fedora/CentOS:**
```bash
sudo dnf install docker docker-compose
```

### Configuration
The configuration should be fairly self-explanatory. Use `example.env` as a reference for your `production.env` file.
Once you are happy with the configuration then you can start the application by running `docker-compose up` or `docker-compose up -d` to run it in the background.

## Getting Help
Please feel free to join the [Break Blocks Club Discord](https://discord.gg/3RUjaRzdKv) for support.