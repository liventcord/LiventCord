FROM golang:1.24-alpine AS builder

WORKDIR /usr/src/app

COPY proxy-api/go.mod proxy-api/go.sum ./

COPY telemetry telemetry

COPY proxy-api proxy-api

WORKDIR /usr/src/app/proxy-api

RUN go mod download

COPY . .
RUN go build -v -o /usr/local/bin/app ./...

FROM alpine:latest

WORKDIR /usr/local/bin
COPY --from=builder /usr/local/bin/app .

CMD ["app"]

ARG MainServerUrl http://localhost:5005
ARG ExternalMediaLimit 5
ARG GinMode release
ARG Host localhost
ARG Port 8080