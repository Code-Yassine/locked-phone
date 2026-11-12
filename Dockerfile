FROM node:22-alpine

WORKDIR /app
COPY server.js index.html scores.html ./
COPY css ./css
COPY js ./js
COPY media ./media

# Scores are kept here. Mount a volume on /app/data to keep them if the container is recreated.
ENV PORT=80 DATA_DIR=/app/data ADMIN_KEY=kickoff-gm
VOLUME /app/data
EXPOSE 80
CMD ["node", "server.js"]
