import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class PersonalAssistant:
    def __init__(self):
        self.knowledge = {
            "python": "Python is a popular programming language known for its simple syntax and wide use in automation, web development, and AI.",
            "javascript": "JavaScript is a programming language used mainly to build interactive websites and web applications.",
            "html": "HTML is the markup language used to structure content on the web.",
            "css": "CSS is used to style and layout web pages.",
            "ai": "Artificial intelligence is the field of building systems that can learn, reason, and make decisions from data.",
            "machine learning": "Machine learning is a branch of AI where systems improve from examples instead of being manually programmed for every case.",
            "chatgpt": "ChatGPT is an AI assistant that can help with writing, brainstorming, coding, and answering questions.",
            "openai": "OpenAI is an AI research and deployment company that builds modern language and reasoning systems.",
            "git": "Git is a version control system used to track changes in code and collaborate with others.",
            "github": "GitHub is a platform for hosting and sharing code repositories online.",
            "noun": "A noun is a word that names a person, place, thing, or idea.",
            "program": "A program is a set of instructions that tells a computer what to do.",
            "charles law": "Charles's law states that, at constant pressure, the volume of a gas increases as its temperature increases.",
            "charles's law": "Charles's law states that, at constant pressure, the volume of a gas increases as its temperature increases.",
            "boyle law": "Boyle's law states that, at constant temperature, the pressure of a gas increases as its volume decreases.",
            "boyle's law": "Boyle's law states that, at constant temperature, the pressure of a gas increases as its volume decreases.",
        }

        self.capitals = {
            "france": "Paris",
            "japan": "Tokyo",
            "canada": "Ottawa",
            "india": "New Delhi",
            "germany": "Berlin",
            "italy": "Rome",
            "spain": "Madrid",
            "brazil": "Brasília",
            "egypt": "Cairo",
            "australia": "Canberra",
            "nigeria": "Abuja",
            "south africa": "Pretoria",
        }

    def normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text or "").strip().lower()

    def answer(self, question: str) -> str:
        if not question or not question.strip():
            return "Please ask a question so I can help you."

        q = question.strip()
        nq = self.normalize(q)

        if any(word in nq for word in ["hello", "hi", "hey"]):
            return "Hello! I’m your personal AI assistant. Ask me about facts, study help, coding, or everyday topics."

        if "time" in nq:
            return f"The current time is {datetime.now().strftime('%I:%M %p')}."

        if "date" in nq:
            return f"Today is {datetime.now().strftime('%B %d, %Y')}."

        if "who are you" in nq or "what is your name" in nq:
            return "I’m a personal AI assistant designed to help with questions, explanations, planning, and simple problem solving."

        if "charles" in nq and "law" in nq:
            return "Charles's law states that, at constant pressure, the volume of a gas increases as its temperature increases."

        if "boyle" in nq and "law" in nq:
            return "Boyle's law states that, at constant temperature, the pressure of a gas increases as its volume decreases."

        if "noun" in nq:
            return "A noun is a word that names a person, place, thing, or idea."

        if "program" in nq and "programming" not in nq and "language" not in nq:
            return "A program is a set of instructions that tells a computer what to do."

        if "thank" in nq:
            return "You’re welcome. I’m happy to help."

        if "weather" in nq:
            return "I can help with general weather advice, but I cannot access live weather data unless you share your location."

        if "math" in nq or "calculate" in nq or "solve" in nq:
            result = self._evaluate_math(q)
            if result is not None:
                return result

        if "capital of" in nq:
            for country, capital in self.capitals.items():
                if country in nq:
                    return f"The capital of {country.replace('-', ' ').title()} is {capital}."

        if "what is" in nq or "who is" in nq or "where is" in nq or "when was" in nq or "who wrote" in nq:
            wikipedia_summary = self._fetch_wikipedia_summary(q)
            if wikipedia_summary:
                return wikipedia_summary

        for keyword, answer in self.knowledge.items():
            if keyword in nq:
                return answer

        if "how to" in nq:
            return f"A strong way to approach that is to break the task into simple steps, try the first step, and adjust as you learn."

        if "why" in nq:
            return "A clear explanation usually starts with the main cause, then adds one simple example so the reason is easier to understand."

        if "explain" in nq or "definition" in nq or "mean" in nq:
            return f"Here is a simple explanation: {q} is best understood by describing its purpose, its main parts, and a short example."

        return (
            "I can help with that. If you give me a bit more detail, I can give a more precise answer. "
            "For example, I can explain ideas, help with study topics, assist with coding, or answer general facts."
        )

    def _evaluate_math(self, expression: str):
        cleaned = re.sub(r"[^0-9+\-*/().% ]", "", expression)
        if not cleaned or cleaned == expression:
            return None
        try:
            value = eval(cleaned, {"__builtins__": {}}, {})
            return f"The result is {value}."
        except Exception:
            return None

    def _fetch_wikipedia_summary(self, question: str):
        query = question.strip()
        for prefix in ["what is ", "who is ", "where is ", "when was ", "who wrote ", "what are "]:
            if query.lower().startswith(prefix):
                query = query[len(prefix):].strip()
                break

        if not query:
            return None

        encoded = urllib.parse.quote(query)
        urls = [
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}",
            f"https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search={encoded}",
        ]

        for url in urls:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "PersonalAI/1.0"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = json.load(response)
                    if isinstance(data, dict) and data.get("extract"):
                        title = data.get("title", query)
                        text = data.get("extract", "")
                        return f"{title}: {text[:500]}"
                    if isinstance(data, list) and len(data) > 1 and data[1]:
                        result = data[1][0]
                        if result:
                            return self._fetch_wikipedia_summary(result)
            except Exception:
                continue

        return None


assistant = PersonalAssistant()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/ask":
            self.send_json({"answer": "Please use a POST request with your question."})
            return

        safe_path = parsed.path.lstrip("/") or "index.html"
        if safe_path.startswith(".."):
            safe_path = "index.html"

        target = (ROOT / safe_path).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_error(403)
            return

        if target.is_dir():
            target = target / "index.html"

        if not target.exists():
            self.send_error(404)
            return

        content_type = self._content_type_for(target)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        with target.open("rb") as handle:
            self.wfile.write(handle.read())

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/ask":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else ""

        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {}

        question = (payload.get("question") or "").strip()
        self.send_json({"answer": assistant.answer(question)})

    def send_json(self, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _content_type_for(self, path: Path) -> str:
        if path.suffix.lower() == ".html":
            return "text/html; charset=utf-8"
        if path.suffix.lower() == ".css":
            return "text/css; charset=utf-8"
        if path.suffix.lower() == ".js":
            return "application/javascript; charset=utf-8"
        return "application/octet-stream"

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8000), Handler)
    print("Assistant server running at http://127.0.0.1:8000")
    server.serve_forever()
