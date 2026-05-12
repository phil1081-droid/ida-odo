# server.py
from http.server import SimpleHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
import json

pending_events = []  # Nur Events seit letztem Poll (wird geleert!)

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/events':
            global pending_events
            events_to_send = pending_events.copy()
            pending_events = []
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(events_to_send).encode('utf-8'))
        else:
            # Statische Dateien über SimpleHTTPRequestHandler ausliefern
            super().do_GET()

    def do_POST(self):
        if self.path == '/input':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data)
                print("📨 Neues Event:", data)
                pending_events.append(data)
            except json.JSONDecodeError:
                print("Ungültiges JSON")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

    def log_message(self, format, *args):
        # /events-Polling nicht in der Konsole zumüllen
        if '/events' not in args[0]:
            super().log_message(format, *args)

if __name__ == '__main__':
    PORT = 8080
    server = ThreadingHTTPServer(('', PORT), Handler)
    print(f"Server läuft auf http://localhost:{PORT}")
    print(f"  Spiel:       http://localhost:{PORT}/index.html")
    print(f"  Multiplayer: http://localhost:{PORT}/multiplay.html")
    print(f"  Joy-Con API: POST /input  |  GET /events")
    server.serve_forever()
