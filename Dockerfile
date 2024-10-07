FROM --platform=linux/amd64 node:17

ARG APP_PATH=/opt/samoc-server/

WORKDIR ${APP_PATH}

RUN apt-get update -y

COPY . .

RUN mv .env.bamboo .env

RUN yarn global add typescript nodemon ts-node && \
    yarn install && \
    yarn build

EXPOSE 1337
CMD ["yarn", "serve"]