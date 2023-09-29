FROM oven/bun

WORKDIR /usr/src/app

COPY package*.json bun.lockb ./
RUN bun install
COPY . .

ENV NODE_ENV production
RUN bun build:prod
CMD [ "bun", "start" ]