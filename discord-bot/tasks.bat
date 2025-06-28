@echo off
setlocal

set "VENV=venv\Scripts\activate"
set "PYTHON=python"
set "API_URL=https://liventcord.koyeb.app"

if "%1"=="run" goto run
if "%1"=="lint" goto lint
if "%1"=="format" goto format
if "%1"=="generate-python-client" goto generate_python_client
if "%1"=="setup" goto setup

echo Invalid task. Available tasks: run, lint, format, generate-python-client, setup
goto end

:run
call %VENV%
%PYTHON% src\main.py
goto end

:lint
call %VENV%
venv\Scripts\ruff check src --fix
%PYTHON% -m mypy --config-file src\mypy.ini --ignore-missing-imports src
goto end

:format
call %VENV%
venv\Scripts\ruff format src
goto end

:generate_python_client
call %VENV%
cd src
openapi-python-client generate --url %API_URL%/swagger/v1/swagger.json --overwrite
cd ..
%PYTHON% src\patch_instance_package.py
pip uninstall livent-cord-client -y
pip install src\livent-cord-client
goto end

:setup
%PYTHON% -m venv venv
call %VENV%
pip install -r requirements.txt
call tasks.bat generate-python-client
goto end

:end
endlocal
