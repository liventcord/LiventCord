FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
ARG TARGETARCH
WORKDIR /source

COPY --link src/*.csproj .
RUN dotnet restore --runtime linux-musl-x64

COPY --link src/. .

# /p:PublishTrimmed=true causes controllers not being registered
RUN dotnet publish -c Release --runtime linux-musl-x64 -o /app /p:PublishSingleFile=true

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine
WORKDIR /app
COPY --link --from=build /app .

USER root

RUN chmod +x ./LiventCord

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["./LiventCord"]
