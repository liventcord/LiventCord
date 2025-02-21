FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
ARG TARGETARCH
WORKDIR /source
RUN apk add --no-cache nodejs npm bash curl python3 make g++
COPY --link server/src/*.csproj ./server/src/
RUN dotnet restore /source/server/src/*.csproj --runtime linux-musl-x64
COPY --link server/src/ ./server/src/
COPY --link web/. ./web/  
RUN test -f server/src/Properties/appsettings.json && cp server/src/Properties/appsettings.json server/src/Properties/ || echo "Skipping appsettings.json copy"
WORKDIR /source/server/src
RUN dotnet publish -c Release --runtime linux-musl-x64 -o /source/server/src /p:PublishSingleFile=true

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine
RUN apk add --no-cache nodejs npm bash curl python3 make g++ 
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --link --from=build /source/server/src /app/server/src
COPY --link --from=build /source/web/ /app/web/
RUN chown -R appuser:appgroup /app
RUN chmod +x /app/server/src/LiventCord
USER appuser
EXPOSE 5005
WORKDIR /app/server/src
ENTRYPOINT ["./LiventCord"]
