# --- Backend Build Stage ---
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /source
COPY server/LiventCord/*.csproj ./server/LiventCord/
RUN dotnet restore ./server/LiventCord/LiventCord.csproj --runtime linux-musl-x64
COPY server/LiventCord/ ./server/LiventCord/
WORKDIR /source/server/LiventCord
RUN dotnet publish -c Release --runtime linux-musl-x64 -o /source/published /p:PublishSingleFile=false
RUN if [ -d /source/published/publish ]; then mv /source/published/publish/* /source/published/; rm -rf /source/published/publish; fi

# --- Runtime Stage ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /source/published/ /app/
RUN chown -R appuser:appgroup /app
RUN [ -f /app/LiventCord ] && chmod +x /app/LiventCord || true
USER appuser
EXPOSE 5005
ENTRYPOINT ["./LiventCord"]


ARG Host
ARG Port
ARG RemoteConnection
ARG DatabaseType
ARG MaxPoolSize
ARG MinPoolSize
ARG SqlitePath
ARG FrontendUrl
ARG MaxAvatarSize
ARG MaxAttachmentsSize
ARG BotToken
ARG EnableMetadataIndexing
ARG MetadataDomainLimit
ARG RedisConnectionString
ARG RedisConnectionLimit
ARG JwtKey