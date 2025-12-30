FROM golang:1.24-alpine AS builder

WORKDIR /usr/src/app

COPY media-api/go.mod media-api/go.sum ./media-api/

COPY telemetry ./telemetry
COPY media-api ./media-api

WORKDIR /usr/src/app/media-api

RUN go mod download

RUN go build -v -o /usr/local/bin/app

FROM alpine:latest

RUN apk add --no-cache python3 py3-pip py3-venv ffmpeg wget gcc musl-dev libffi-dev openssl-dev make \
    && wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp


WORKDIR /usr/local/bin

COPY --from=builder /usr/local/bin/app .

CMD ["app"]

ARG CORS_DOMAINS
