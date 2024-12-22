FROM node:current-buster
RUN apt-get update && apt-get upgrade -y
COPY . /app/
WORKDIR /app
RUN npm install
CMD ["npm", "start"]