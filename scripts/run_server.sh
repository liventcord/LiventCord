xterm -hold -e "cd server/src && dotnet watch run" &
xterm -hold -e "cd server/proxy-api && go run ." &
xterm -hold -e "cd server/go-ws-api && go run ." &