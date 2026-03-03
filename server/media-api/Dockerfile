FROM golang:1.24-alpine AS builder

WORKDIR /usr/src/app

COPY media-api/go.mod media-api/go.sum ./media-api/
COPY telemetry ./telemetry
COPY media-api ./media-api

WORKDIR /usr/src/app/media-api

RUN go mod download
RUN go build -v -o /app/server

FROM alpine:latest

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN apk add --no-cache python3 py3-pip ffmpeg gcc musl-dev libffi-dev openssl-dev make

WORKDIR /app

RUN python3 -m venv venv \
    && ./venv/bin/pip install --upgrade pip \
    && ./venv/bin/pip install spotdl yt-dlp

COPY --from=builder /app/server .

RUN mkdir -p /app/cache && chown -R appuser:appgroup /app

ENV PATH="/app/venv/bin:$PATH"
ENV CacheDirectory="/app/cache"

USER appuser

CMD ["./server"]

ARG CORS_DOMAINS