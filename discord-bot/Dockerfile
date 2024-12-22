FROM node:current-buster
RUN apt-get update && apt-get upgrade -y
RUN apt-get install curl jq wget -y
COPY . /app/
WORKDIR /app
RUN npm install
CMD ["npm", "start"]