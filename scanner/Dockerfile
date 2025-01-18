FROM node:current-buster
RUN apt-get update && apt-get upgrade -y && apt-get install -y masscan libpcap-dev wget
COPY . /app/
WORKDIR /app
RUN wget 'https://raw.githubusercontent.com/robertdavidgraham/masscan/refs/heads/master/data/exclude.conf' -O /etc/exclude.txt
RUN npm install
CMD ["npm", "start"]