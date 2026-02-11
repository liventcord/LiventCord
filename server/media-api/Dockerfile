FROM golang:1.24-alpine AS builder

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

COPY media-api/go.mod media-api/go.sum ./media-api/
COPY telemetry ./telemetry
COPY media-api ./media-api

WORKDIR /usr/src/app/media-api

RUN go mod download
RUN go build -v -o /usr/local/bin/app

USER appuser

FROM alpine:latest

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN apk add --no-cache python3 py3-pip ffmpeg wget git gcc musl-dev libffi-dev openssl-dev make

WORKDIR /usr/local/bin

RUN python3 -m venv venv \
    && ./venv/bin/pip install --upgrade pip \
    && ./venv/bin/pip install spotdl yt-dlp

COPY --from=builder /usr/local/bin/app .

ENV PATH="/usr/local/bin/venv/bin:$PATH"

USER appuser

CMD ["app"]

ARG CORS_DOMAINS
