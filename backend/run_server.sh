#!/bin/bash
# Activate the virtual environment
source "$(dirname "$0")/.venv/bin/activate"
# Change to the directory that needs to be served (the 'example' directory)
cd "$(dirname "$0")/.."
# Start the server
echo "Starting server at http://localhost:8000"
python3 -m http.server 8000
