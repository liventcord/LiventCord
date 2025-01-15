#!/bin/bash

dotnet run & 
DOTNET_PID=$!
echo "Started .NET application (PID: $DOTNET_PID). Waiting for it to initialize..."

sleep 10

rm -f swagger.json
SWAGGER_URL="http://localhost:5005/swagger/v1/swagger.json"

curl -s $SWAGGER_URL --output swagger.json
if [ $? -ne 0 ] || [ ! -s swagger.json ]; then
    echo "Failed to download Swagger JSON from $SWAGGER_URL"
    kill $DOTNET_PID
    exit 1
fi
echo "Downloaded Swagger JSON to swagger.json"

redocly build-docs swagger.json
mv redoc-static.html wwwroot/redocs.html
echo "Generated redoc!"

kill $DOTNET_PID
exit 1

