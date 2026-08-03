FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build-base

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .

ARG VITE_BOT_USERNAME=""
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME

FROM build-base AS demo-build
RUN npm run build

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS runtime-base
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

FROM runtime-base AS demo
COPY --from=demo-build /app/dist /usr/share/nginx/html
USER nginx

FROM build-base AS production-build
RUN npm run build:production

FROM runtime-base AS production
COPY --from=production-build /app/dist /usr/share/nginx/html
COPY site-release/ /usr/share/nginx/html/
USER nginx
