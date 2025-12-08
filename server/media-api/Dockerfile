FROM golang:1.24-alpine AS builder

WORKDIR /usr/src/app

COPY media-api/go.mod media-api/go.sum ./

COPY telemetry telemetry

RUN go mod download

COPY media-api ./
RUN go build -v -o /usr/local/bin/app

FROM alpine:latest
RUN apk add --no-cache wget ffmpeg python3 py3-pip && \
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

WORKDIR /usr/local/bin
COPY --from=builder /usr/local/bin/app .

CMD ["app"]

ARG CORS_DOMAINS
