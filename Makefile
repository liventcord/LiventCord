SHELL := /bin/bash
.DEFAULT_GOAL := run

TERMINAL := $(shell \
	if command -v gnome-terminal >/dev/null 2>&1; then echo gnome-terminal; \
	elif command -v xterm >/dev/null 2>&1; then echo xterm; \
	elif command -v konsole >/dev/null 2>&1; then echo konsole; \
	else echo ""; fi)

OS := $(shell uname)

run:
ifeq ($(OS),Linux)
	@if command -v tmux >/dev/null 2>&1; then \
		if ! tmux has-session -t redis 2>/dev/null; then \
			tmux new-session -d -s redis 'redis-server'; \
			echo "Started Redis tmux session"; \
		else \
			echo "Redis tmux session already exists, skipping"; \
		fi \
	else \
		echo "tmux not found, skipping Redis"; \
	fi
	@if [ -n "$(TERMINAL)" ]; then \
		$(TERMINAL) -- bash -c "dotnet watch --project ./server/LiventCord run; exec bash" & \
		$(TERMINAL) -- bash -c "cd ./server/ws-api && go run .; exec bash" & \
		$(TERMINAL) -- bash -c "pnpm --prefix ./web run dev; exec bash" & \
		$(TERMINAL) -- bash -c "cd ./server/media-api && go run .; exec bash" & \
	else \
		echo "No terminal found"; \
	fi
endif
ifeq ($(OS),Windows_NT)
	start cmd /k "dotnet watch --project .\server\LiventCord run"
	start cmd /k "cd .\server\ws-api && go run ."
	start cmd /k "pnpm --prefix .\web run dev"
	start cmd /k "cd .\server\media-api && go run ."
endif

format:
	@echo "Starting formatting scripts..."
	@node scripts/format_ts_css.js &
	@node scripts/format_csharp.js &
	@wait
	@echo "Formatting scripts completed."