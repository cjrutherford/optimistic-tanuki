#!/bin/bash
set -e

echo "Starting audio model server..."

# Pre-load models
python3 -c "
import torch
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'CUDA devices: {torch.cuda.device_count()}')

# Verify audiocraft import
from audiocraft.models import MusicGen
print('MusicGen available')

# Verify demucs import
import demucs.separate
print('Demucs available')
"

# Start a simple HTTP server to accept inference requests
python3 -c "
import http.server
import json
import torch
import sys
import io
import wave

class AudioModelHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        data = json.loads(body)

        if self.path == '/generate':
            response = self.handle_generate(data)
        elif self.path == '/separate':
            response = self.handle_separate(data)
        else:
            response = {'error': 'Unknown endpoint'}

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def handle_generate(self, data):
        print(f'Generate request: {data.get(\"prompt\", \"\")[:50]}...')
        return {'status': 'ok', 'message': 'Generation queued'}

    def handle_separate(self, data):
        print(f'Separation request for asset: {data.get(\"assetId\", \"unknown\")}')
        return {'status': 'ok', 'message': 'Separation queued'}

    def log_message(self, format, *args):
        print(f'[AudioModelServer] {format % args}')

server = http.server.HTTPServer(('0.0.0.0', 3100), AudioModelHandler)
print('Audio model server listening on port 3100...')
server.serve_forever()
" &
MODEL_PID=$!

# Trap SIGTERM and clean up
trap "kill $MODEL_PID; exit 0" SIGTERM SIGINT

wait $MODEL_PID
