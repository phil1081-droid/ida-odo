# server.py
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

pending_events = []  # Nur Events seit letztem Poll (wird geleert!)

class Handler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def end_headers(self):
        self._set_cors_headers()
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/events':
            global pending_events
            # Gib alle gesammelten Events zurück und leere die Liste
            events_to_send = pending_events.copy()  # Kopie, damit race conditions vermieden
            pending_events = []  # Reset – keine Wachstum!
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(events_to_send).encode('utf-8'))
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Server laeuft! GET /events fur neue Joy-Con-Events.')

    def do_POST(self):
        if self.path == '/input':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data)
                print("📨 Neues Event:", data)
                pending_events.append(data)  # Sammeln bis nächster GET
            except json.JSONDecodeError:
                print("Ungültiges JSON")
            
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

if __name__ == '__main__':
    PORT = 8080
    server = HTTPServer(('', PORT), Handler)
    print(f"Server läuft auf http://localhost:{PORT}/events")
    print("Events werden gesammelt und bei jedem GET geleert.")
    server.serve_forever()
