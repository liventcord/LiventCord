FROM golang:1.24-alpine AS builder
WORKDIR /usr/src/app
COPY ws-api/go.mod ws-api/go.sum ./
COPY telemetry telemetry
COPY ws-api ws-api
WORKDIR /usr/src/app/ws-api
RUN go mod download
COPY . .
RUN go build -v -o /usr/local/bin/app ./...

FROM alpine:latest
WORKDIR /usr/local/bin

ENV DOTNET_API_URL=http://localhost:5005
ENV REDIS_CONNECTION_STRING=redis://localhost:6379
ENV GIN_MODE=release
ENV HOST=localhost
ENV PORT=8080

COPY --from=builder /usr/local/bin/app .
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["app"]