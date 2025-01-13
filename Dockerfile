FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
ARG TARGETARCH
WORKDIR /source

COPY --link *.csproj .
RUN dotnet restore --runtime linux-musl-x64

COPY --link . . 
RUN dotnet publish -c Release --runtime linux-musl-x64 -o /app --self-contained true /p:PublishTrimmed=true /p:PublishSingleFile=true

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine
WORKDIR /app
COPY --link --from=build /app .

USER root

RUN chmod +x ./LiventCord

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["./LiventCord"]
