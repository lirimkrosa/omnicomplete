FROM node:18 AS build
ENV NODE_ENV=production
ENV API_KEY secret
EXPOSE 8080
EXPOSE 3000
FROM nginx:alpine AS runner
