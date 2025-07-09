FROM golang:1.24-alpine AS builder

WORKDIR /usr/src/app

COPY go-ws-api/go.mod go-ws-api/go.sum ./

COPY telemetry telemetry

COPY go-ws-api go-ws-api

WORKDIR /usr/src/app/go-ws-api
RUN go mod download

COPY . .
RUN go build -v -o /usr/local/bin/app ./...

FROM alpine:latest

WORKDIR /usr/local/bin
COPY --from=builder /usr/local/bin/app .

CMD ["app"]

ARG DotnetApiUrl http://localhost:5005
ARG RedisConnectionString redis://localhost:6379
ARG GinMode release
ARG Host localhost
ARG Port 8080