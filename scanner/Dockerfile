FROM node:current-buster
RUN apt-get update && apt-get upgrade -y && apt-get install -y masscan libpcap-dev
COPY . /app/
WORKDIR /app
RUN npm install
CMD ["npm", "start"]