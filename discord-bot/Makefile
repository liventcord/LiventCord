.PHONY: lint format run generate-python-client setup

SHELL := /bin/bash
VENV_ACTIVATE = venv/bin/activate
API_URL = https://liventcord.koyeb.app
PYTHON = python3.13

ifeq ($(OS),Windows_NT)
    VENV_ACTIVATE = venv/Scripts/activate
    PYTHON = python
endif

run:
	. $(VENV_ACTIVATE) && $(PYTHON) src/main.py

lint:
	. $(VENV_ACTIVATE) && venv/bin/ruff check src --fix
	. $(VENV_ACTIVATE) && $(PYTHON) -m mypy --config-file src/mypy.ini --ignore-missing-imports src

format:
	. $(VENV_ACTIVATE) && venv/bin/ruff format src

generate-python-client:
	. $(VENV_ACTIVATE) && cd src && openapi-python-client generate --url $(API_URL)/swagger/v1/swagger.json --overwrite
	. $(VENV_ACTIVATE) && $(PYTHON) src/patch_instance_package.py
	. $(VENV_ACTIVATE) && pip uninstall livent-cord-client -y
	. $(VENV_ACTIVATE) && pip install src/livent-cord-client

setup:
	$(PYTHON) -m venv venv
	. $(VENV_ACTIVATE) && pip install -r requirements.txt
	$(MAKE) generate-python-client
