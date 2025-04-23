# --- Backend Build Stage ---
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
ARG TARGETARCH
WORKDIR /source
COPY --link server/src/*.csproj ./server/src/
RUN dotnet restore /source/server/src/*.csproj --runtime linux-musl-x64
COPY --link server/src/ ./server/src/
WORKDIR /source/server/src
RUN dotnet publish -c Release --runtime linux-musl-x64 -o /source/published /p:PublishSingleFile=false

# --- Runtime Stage ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /source/published /app/
RUN chown -R appuser:appgroup /app
RUN chmod +x /app/LiventCord
USER appuser
EXPOSE 5005


ARG Host
ARG Port
ARG RemoteConnection
ARG DatabaseType
ARG MaxPoolSize
ARG MinPoolSize
ARG SqlitePath
ARG FrontendUrl
ARG GifWorkerUrl
ARG ProxyWorkerUrl
ARG MediaProxyApiUrl
ARG MaxAvatarSize
ARG MaxAttachmentsSize
ARG BotToken
ARG EnableMetadataIndexing
ARG MetadataDomainLimit
ARG RedisConnectionString
ARG RedisConnectionLimit