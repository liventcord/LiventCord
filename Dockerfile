FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
ARG TARGETARCH
WORKDIR /source

RUN apk add --no-cache nodejs npm

COPY --link server/src/*.csproj .
RUN dotnet restore --runtime linux-musl-x64

COPY --link server/src/. .
COPY --link web/src/. .
COPY --link server/src/Properties/appsettings.json server/src/Properties/ || true

WORKDIR /source/src

WORKDIR /source

# /p:PublishTrimmed=true causes controllers not being registered
RUN dotnet publish -c Release --runtime linux-musl-x64 -o /app /p:PublishSingleFile=true

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --link --from=build /app .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5005

ENTRYPOINT ["./LiventCord"]
