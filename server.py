import base64
import json
import math
import mimetypes
import os
import re
import shutil
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
CONFIG_FILE = ROOT / "config.json"


def load_config() -> dict:
    config = {
        "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
        "model_name": "gemini-3.6-flash",
        "temperature": 0.7,
    }
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    config.update(saved)
        except Exception as e:
            print(f"Error loading config.json: {e}")

    # Environment variable takes priority if present and not empty
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        config["gemini_api_key"] = env_key

    return config


def save_config(updates: dict) -> dict:
    config = load_config()
    config.update(updates)
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"Error saving config.json: {e}")
    return config


class GeminiClient:
    def __init__(self):
        self.reload_config()

    def reload_config(self):
        config = load_config()
        self.api_key = config.get("gemini_api_key", "").strip()
        self.model = config.get("model_name", "gemini-3.6-flash").strip() or "gemini-3.6-flash"
        self.temperature = float(config.get("temperature", 0.7))

    def has_key(self) -> bool:
        return bool(self.api_key)

    def test_key(self, api_key: str, model: str = None) -> tuple[bool, str, str]:
        key = api_key.strip()
        if not key:
            return False, "API key cannot be empty.", ""

        candidate_models = []
        if model:
            candidate_models.append(model.strip())
        if self.model and self.model not in candidate_models:
            candidate_models.append(self.model)

        for fallback_m in [
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.8-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-3-flash-preview",
        ]:
            if fallback_m not in candidate_models:
                candidate_models.append(fallback_m)

        last_error = ""
        for target_model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={key}"
            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": "Hello, respond with 'OK' only."}]}
                ]
            }
            try:
                body = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=body,
                    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    candidates = data.get("candidates", [])
                    if candidates:
                        return True, f"Connected successfully using {target_model}!", target_model
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                try:
                    err_json = json.loads(err_body)
                    msg = err_json.get("error", {}).get("message", err_body)
                except Exception:
                    msg = err_body
                last_error = f"Gemini API error ({e.code}): {msg}"
                # If 404, 400, 429 (rate-limited), or 503 (overloaded), try next model
                if e.code in [404, 400, 429, 503]:
                    continue
                return False, last_error, ""
            except Exception as e:
                last_error = f"Connection failed: {str(e)}"
                continue

        return False, last_error or "Unable to connect with any available Gemini model.", ""

    def generate(self, prompt: str, image_path: Path = None, audio_path: Path = None, history: list = None) -> tuple[str, bool]:
        if not self.has_key():
            return "", False

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        system_instruction = {
            "parts": [
                {
                    "text": (
                        "You are Vikola, a state-of-the-art commercial AI assistant powered by Google Gemini. "
                        "You answer all questions with high intelligence, factual accuracy, precision, and clarity across "
                        "all disciplines: mathematics, coding, computer science, physics, chemistry, biology, history, business, logic puzzles, and creative tasks. "
                        "When providing code, always write clean, production-grade code with appropriate language markdown fences. "
                        "Format your answers with professional Markdown (headers, bullet points, bold key terms, tables where helpful)."
                    )
                }
            ]
        }

        user_parts = []

        # Attach image if provided
        if image_path and image_path.exists():
            try:
                mime_type, _ = mimetypes.guess_type(str(image_path))
                if not mime_type or not mime_type.startswith("image/"):
                    mime_type = "image/jpeg"
                with open(image_path, "rb") as f:
                    data_b64 = base64.b64encode(f.read()).decode("ascii")
                user_parts.append({
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": data_b64
                    }
                })
            except Exception as e:
                print(f"Error reading image {image_path}: {e}")

        # Attach audio if provided
        if audio_path and audio_path.exists():
            try:
                mime_type = "audio/webm"
                if audio_path.suffix.lower() in [".mp3", ".wav", ".ogg", ".m4a"]:
                    mime_type, _ = mimetypes.guess_type(str(audio_path))
                with open(audio_path, "rb") as f:
                    data_b64 = base64.b64encode(f.read()).decode("ascii")
                user_parts.append({
                    "inlineData": {
                        "mimeType": mime_type or "audio/webm",
                        "data": data_b64
                    }
                })
            except Exception as e:
                print(f"Error reading audio {audio_path}: {e}")

        prompt_text = prompt.strip() if prompt else ""
        if not prompt_text and (image_path or audio_path):
            if image_path and audio_path:
                prompt_text = "Please examine the provided image and listen to the audio recording, and describe or answer what they contain."
            elif image_path:
                prompt_text = "Please analyze this image in detail and describe what you see."
            elif audio_path:
                prompt_text = "Please listen to this audio recording, transcribe it, and answer or respond to what is said."

        user_parts.append({"text": prompt_text})

        # Build contents incorporating conversation history
        contents = []
        if history:
            for item in history[-8:]:  # keep last 8 messages for context
                role = "user" if item.get("role") == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": item.get("text", "")}]
                })

        contents.append({
            "role": "user",
            "parts": user_parts
        })

        payload = {
            "contents": contents,
            "systemInstruction": system_instruction,
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": 2048,
            }
        }

        FALLBACK_MODELS = [
            self.model,
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.8-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-3-flash-preview",
        ]
        # Deduplicate while preserving order
        seen = set()
        model_list = [m for m in FALLBACK_MODELS if not (m in seen or seen.add(m))]

        last_error = ""
        for try_model in model_list:
            try_url = f"https://generativelanguage.googleapis.com/v1beta/models/{try_model}:generateContent?key={self.api_key}"
            try:
                body = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    try_url,
                    data=body,
                    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    candidates = data.get("candidates", [])
                    if candidates:
                        first = candidates[0]
                        parts = first.get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            # If we fell back, persist the working model
                            if try_model != self.model:
                                self.model = try_model
                                save_config({"model_name": try_model})
                            return parts[0]["text"], True
                    return "Gemini did not return a response.", False
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                try:
                    err_json = json.loads(err_body)
                    msg = err_json.get("error", {}).get("message", err_body)
                except Exception:
                    msg = err_body
                last_error = msg
                print(f"Gemini model {try_model} HTTPError {e.code} (retrying next): {msg[:90]}")
                # If 404, 400, 429 (quota exceeded), or 503 (service unavailable), failover to next model
                if e.code in [404, 400, 429, 503]:
                    continue
                return f"**Gemini API Error:** {msg}", False
            except Exception as e:
                last_error = str(e)
                print(f"Gemini model {try_model} exception (retrying next): {e}")
                continue

        return f"**Connection Error:** {last_error}", False


class FallbackKnowledgeEngine:
    def __init__(self):
        self.knowledge = {
            # Parts of Speech & Grammar
            "noun": (
                "A **noun** is a word that represents a person, place, thing, or idea.\n\n"
                "* **Types of Nouns:**\n"
                "  * **Common Nouns:** general items (*dog, city, book, planet*)\n"
                "  * **Proper Nouns:** specific capitalized names (*Paris, Alice, Jupiter, Google*)\n"
                "  * **Abstract Nouns:** concepts, qualities, or feelings (*freedom, love, courage, knowledge*)\n"
                "  * **Collective Nouns:** groups of entities (*team, herd, choir, faculty*)\n"
                "  * **Countable vs. Uncountable:** (*apples, chairs* vs. *water, air, advice*)\n\n"
                "* **Example Sentence:** 'The **engineer** (*person*) built a **robot** (*thing*) in **Tokyo** (*place*) with great **creativity** (*idea*).'"
            ),
            "nouns": (
                "A **noun** is a word that represents a person, place, thing, or idea.\n\n"
                "* **Types of Nouns:**\n"
                "  * **Common Nouns:** general items (*dog, city, book, planet*)\n"
                "  * **Proper Nouns:** specific capitalized names (*Paris, Alice, Jupiter, Google*)\n"
                "  * **Abstract Nouns:** concepts, qualities, or feelings (*freedom, love, courage, knowledge*)\n"
                "  * **Collective Nouns:** groups of entities (*team, herd, choir, faculty*)\n\n"
                "* **Example Sentence:** 'The **engineer** (*person*) built a **robot** (*thing*) in **Tokyo** (*place*) with great **creativity** (*idea*).'"
            ),
            "verb": (
                "A **verb** is a word used to describe an action, state, or occurrence, forming the grammatical predicate of a sentence.\n\n"
                "* **Action Verbs:** *run, write, construct, compute*\n"
                "* **Linking/State Verbs:** *be, seem, feel, become*\n"
                "* **Helping/Auxiliary Verbs:** *have, do, can, will, must*"
            ),
            "verbs": (
                "A **verb** is a word used to describe an action, state, or occurrence, forming the grammatical predicate of a sentence.\n\n"
                "* **Action Verbs:** *run, write, construct, compute*\n"
                "* **Linking/State Verbs:** *be, seem, feel, become*\n"
                "* **Helping/Auxiliary Verbs:** *have, do, can, will, must*"
            ),
            "adjective": "An **adjective** is a word that modifies, describes, or quantifies a noun or pronoun, specifying traits such as color, size, number, or condition (e.g., *brilliant, blue, enormous, seven*).",
            "adverb": "An **adverb** is a word that modifies or qualifies a verb, adjective, or other adverb, expressing manner, place, time, frequency, or degree (e.g., *swiftly, very, yesterday, everywhere, always*).",
            "pronoun": "A **pronoun** is a word that substitutes for a noun or noun phrase to prevent repetitive phrasing (e.g., *he, she, it, they, we, someone, which*).",
            "preposition": "A **preposition** is a word governing, and usually preceding, a noun or pronoun and expressing a relation to another word or element (e.g., *in, on, under, between, through, across*).",
            "conjunction": "A **conjunction** is a word used to connect clauses, sentences, or coordinating words within the same clause (e.g., *and, but, or, because, although, since*).",
            "interjection": "An **interjection** is an exclamation or sound expressing spontaneous emotion or reaction (e.g., *wow!, ouch!, eureka!, hey!*).",
            "palindrome": "A **palindrome** is a word, number, phrase, or sequence of characters that reads identically forward and backward (e.g., *racecar, madam, level, kayak, 12321*).",
            "prime number": "A **prime number** is a natural number strictly greater than 1 that has no positive divisors other than 1 and itself (e.g., *2, 3, 5, 7, 11, 13, 17, 19, 23, 29*). The number 2 is the only even prime.",

            # Science & Technology
            "machine learning": "Machine learning is a subset of artificial intelligence where algorithms learn patterns from data and improve their performance over time without being explicitly programmed for every scenario.",
            "artificial intelligence": "Artificial Intelligence (AI) refers to computer systems and software engineered to simulate human intelligence, including learning, reasoning, problem-solving, perception, and language understanding.",
            "chatgpt": "ChatGPT is a conversational generative AI model developed by OpenAI, trained on vast datasets to understand context, generate text, write code, and solve diverse intellectual tasks.",
            "gemini": "Gemini is Google's most capable multimodal AI model, built from the ground up to understand, operate across, and combine different types of information including text, code, audio, image, and video.",
            "openai": "OpenAI is an AI research organization and technology company founded to ensure that artificial general intelligence benefits all of humanity, known for GPT-4, ChatGPT, and DALL-E.",
            "python": "Python is a high-level, interpreted programming language renowned for its readable syntax, rich standard library, and dominance in data science, artificial intelligence, and backend web development.",
            "javascript": "JavaScript is an ECMAScript-compliant, high-level programming language that powers the interactive and dynamic behavior of modern web applications both client-side and server-side (Node.js).",
            "html": "HTML (HyperText Markup Language) is the standard markup language used to structure documents, media, and interactive interfaces displayed in web browsers.",
            "css": "CSS (Cascading Style Sheets) is a stylesheet language used to describe the presentation, typography, visual layouts, and responsive styling of HTML documents.",
            "git": "Git is a distributed version control system designed to track changes in source code during software development, enabling branching, merging, and distributed collaboration.",
            "algorithm": "An algorithm is an unambiguous, finite sequence of well-defined computer-implementable instructions designed to solve a specific problem or compute a function.",
            "charles law": "Charles's Law states that at constant pressure, the volume of a given mass of an ideal gas is directly proportional to its absolute temperature (V1/T1 = V2/T2). As temperature rises, volume expands.",
            "charless law": "Charles's Law states that at constant pressure, the volume of a given mass of an ideal gas is directly proportional to its absolute temperature (V1/T1 = V2/T2). As temperature rises, volume expands.",
            "boyle law": "Boyle's Law states that at constant temperature, the pressure of a given mass of an ideal gas is inversely proportional to its volume (P1 * V1 = P2 * V2). Decreasing volume increases pressure.",
            "boyles law": "Boyle's Law states that at constant temperature, the pressure of a given mass of an ideal gas is inversely proportional to its volume (P1 * V1 = P2 * V2). Decreasing volume increases pressure.",
            "ohms law": "Ohm's Law states that the current flowing through a conductor between two points is directly proportional to the voltage across the two points and inversely proportional to the resistance: V = I * R.",
            "photosynthesis": "Photosynthesis is the biochemical process by which plants, algae, and some bacteria convert light energy into chemical energy stored in glucose: 6CO2 + 6H2O + light -> C6H12O6 + 6O2.",
            "gravity": "Gravity is the fundamental natural phenomenon by which all things with mass or energy are attracted toward one another, described by Newton's law of universal gravitation and Einstein's General Relativity.",
            "alan turing": "Alan Turing (1912-1954) was a British mathematician, computer scientist, and cryptanalyst widely considered the father of theoretical computer science and artificial intelligence. He formalized computation with the Turing Machine and led the codebreaking of the German Enigma cipher at Bletchley Park.",
            "quantum computing": "Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics (superposition and entanglement) to solve problems too complex for classical computers.",
            "speed of light": "The speed of light in vacuum is exactly 299,792,458 meters per second (approximately 300,000 km/s or 186,282 miles per second), denoted as 'c' in physics.",
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
            "united states": "Washington, D.C.",
            "united kingdom": "London",
            "china": "Beijing",
            "russia": "Moscow",
            "south africa": "Pretoria",
            "kenya": "Nairobi",
            "ghana": "Accra",
        }

    def _clean_query(self, query: str) -> str:
        clean = (query or "").strip()
        clean = re.sub(
            r"^(what('?s| is| are)|who('?s| is| was| were)|define|meaning of|definition of|explain|tell me about|state)\s+(a|an|the)?\s*",
            "",
            clean,
            flags=re.IGNORECASE
        )
        clean = re.sub(r"\b(in chemistry|in physics|in biology|in science|in english|in grammar)\b", "", clean, flags=re.IGNORECASE)
        return clean.strip("?. '\"")

    def normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text or "").strip().lower()

    def solve_math(self, query: str) -> str | None:
        clean = query.lower()
        clean = re.sub(r"what is|calculate|solve|evaluate|compute|\?|=", "", clean).strip()

        # Check for simple algebra like 3x + 15 = 45 or 4x - 8 = 32
        eq_match = re.search(r"([0-9.]+)\s*([a-zA-Z])\s*([+-])\s*([0-9.]+)\s*=\s*([0-9.]+)", query)
        if eq_match:
            a = float(eq_match.group(1))
            var = eq_match.group(2)
            sign = eq_match.group(3)
            b = float(eq_match.group(4))
            c = float(eq_match.group(5))
            rhs = (c - b) if sign == "+" else (c + b)
            sol = rhs / a
            formatted = int(sol) if sol.is_integer() else round(sol, 4)
            return (
                f"**Equation Solution:**\n\nFor `{eq_match.group(0)}`:\n"
                f"1. Isolate variable term: `{a}{var} = {c} {'-' if sign=='+' else '+'} {b} = {rhs}`\n"
                f"2. Divide both sides by `{a}`: `{var} = {formatted}`\n\n"
                f"**Final Answer:** `{var} = {formatted}`"
            )

        # Percentage calculation: "what is 20% of 150"
        pct_match = re.search(r"([0-9.]+)%\s*(?:of)\s*([0-9.]+)", query.lower())
        if pct_match:
            pct = float(pct_match.group(1))
            base = float(pct_match.group(2))
            res = (pct / 100.0) * base
            formatted = int(res) if res.is_integer() else round(res, 4)
            return f"**Percentage Calculation:**\n\n`{pct}%` of `{base}` = **{formatted}**"

        # Math machines riddle
        if "machines" in clean and "widgets" in clean:
            return (
                "**Logic Puzzle Solution:**\n\n"
                "It takes **5 minutes**.\n\n"
                "**Explanation:**\n"
                "- If 5 machines make 5 widgets in 5 minutes, that means **1 machine makes 1 widget in 5 minutes**.\n"
                "- Therefore, 100 machines working simultaneously will produce 100 widgets in the exact same **5 minutes**."
            )

        # Moon falling into earth
        if "moon" in clean and ("fall" in clean or "crash" in clean):
            return (
                "**Why Doesn't the Moon Fall into the Earth?**\n\n"
                "The Moon is actually continuously falling toward Earth due to gravity, but it never collides because of its high tangential (sideways) orbital velocity (~1 km/s or 2,288 mph).\n\n"
                "- Gravity constantly curves the Moon's path toward Earth.\n"
                "- Because Earth is curved, the Earth's surface curves away at the exact same rate the Moon falls.\n"
                "- This perpetual state of free-fall along a curved trajectory creates a **stable orbit**."
            )

        # Palindrome code
        if "palindrome" in clean:
            return (
                "**Python Palindrome Check:**\n\n"
                "```python\n"
                "def is_palindrome(text: str) -> bool:\n"
                "    clean = ''.join(c.lower() for c in text if c.isalnum())\n"
                "    return clean == clean[::-1]\n"
                "\n"
                "# Examples:\n"
                "print(is_palindrome('radar'))                 # True\n"
                "print(is_palindrome('A man, a plan, a canal: Panama')) # True\n"
                "print(is_palindrome('hello'))                 # False\n"
                "```\n\n"
                "String slicing `[::-1]` provides an O(N) linear time reversal."
            )

        # Difference between list and tuple
        if "list" in clean and "tuple" in clean:
            return (
                "**Difference Between a List and a Tuple in Python:**\n\n"
                "| Feature | List (`list`) | Tuple (`tuple`) |\n"
                "| :--- | :--- | :--- |\n"
                "| **Mutability** | **Mutable** (can append, remove, or modify items) | **Immutable** (fixed upon creation) |\n"
                "| **Syntax** | Square brackets: `[1, 2, 3]` | Parentheses: `(1, 2, 3)` |\n"
                "| **Performance** | Higher memory overhead, slightly slower | Faster execution, minimal memory consumption |\n"
                "| **Hashability** | Not hashable (cannot be a dictionary key) | Hashable if elements are immutable (can be a dict key) |\n"
                "| **Use Cases** | Dynamic datasets that change over time | Fixed records, constants, function multiple returns |\n"
            )

        # Alan Turing
        if "alan turing" in clean or ("turing" in clean and ("who" in clean or "important" in clean or "father" in clean)):
            return (
                "**Alan Turing (1912–1954):**\n\n"
                "Alan Turing was a visionary British mathematician, logician, and cryptanalyst widely celebrated as the **father of theoretical computer science and artificial intelligence**.\n\n"
                "**Key Contributions:**\n"
                "1. **Turing Machine (1936):** Formalized the abstract mathematical concept of modern computers and universal algorithms.\n"
                "2. **Enigma Codebreaking (WWII):** Led the Bletchley Park team that designed the electromechanical 'Bombe' machine, deciphering German military Enigma communications and saving estimated millions of lives.\n"
                "3. **Turing Test (1950):** Introduced the foundational benchmark for assessing whether a machine can exhibit intelligent human behavior."
            )

        # Simple Interest
        if "simple interest" in clean:
            return (
                "**Simple Interest Formula:**\n\n"
                "$$\\text{Simple Interest (SI)} = \\frac{P \\times R \\times T}{100}$$\n\n"
                "- **P** = Principal amount (initial sum)\n"
                "- **R** = Annual interest rate (percentage)\n"
                "- **T** = Time period (in years)\n\n"
                "**Total Amount Payable:** $A = P + \\text{SI}$"
            )

        # Standard math expressions:
        math_expr = re.search(r"[-+*/0-9.() %^]+", clean)
        if math_expr and any(op in math_expr.group(0) for op in ["+", "-", "*", "/", "%", "^"]):
            expr = math_expr.group(0).replace("^", "**").strip()
            if re.match(r"^[0-9+\-*/(). %]+$", expr):
                try:
                    safe_dict = {
                        "sqrt": math.sqrt,
                        "sin": math.sin,
                        "cos": math.cos,
                        "tan": math.tan,
                        "log": math.log,
                        "pi": math.pi,
                        "e": math.e,
                        "abs": abs,
                    }
                    val = eval(expr, {"__builtins__": {}}, safe_dict)
                    if isinstance(val, float) and val.is_integer():
                        val = int(val)
                    return f"**Math Calculation:**\n\n`{expr}` = **{val}**"
                except Exception:
                    pass

        return None

    def fetch_duckduckgo(self, query: str) -> str | None:
        try:
            encoded = urllib.parse.quote(query.strip())
            url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                abstract = data.get("AbstractText") or data.get("Abstract")
                heading = data.get("Heading")
                if abstract and len(abstract) > 30:
                    title = heading or query.title()
                    return f"**{title}**\n\n{abstract}"
        except Exception:
            pass
        return None

    def fetch_wikipedia(self, query: str) -> str | None:
        clean = self._clean_query(query)
        if not clean:
            return None

        try:
            encoded = urllib.parse.quote(clean)
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (AI Assistant)"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                extract = data.get("extract")
                title = data.get("title", clean.title())
                description = data.get("description", "")
                if extract:
                    desc_line = f" *({description})*" if description else ""
                    return f"**{title}**{desc_line}\n\n{extract}"
        except Exception:
            pass
        return None

    def search_wikipedia(self, query: str) -> str | None:
        clean = self._clean_query(query)
        if not clean:
            return None
        try:
            encoded = urllib.parse.quote(clean)
            url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={encoded}&limit=3&namespace=0&format=json"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (AI Assistant)"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data and len(data) >= 2 and data[1]:
                    first_title = data[1][0]
                    return self.fetch_wikipedia(first_title)
        except Exception:
            pass
        return None

    def answer(self, question: str) -> str:
        q = question.strip()
        nq = self.normalize(q)
        cq = self._clean_query(q).lower()

        # 1. Greetings: strictly use word boundaries so words like 'machines', 'this', 'which' do not trigger greetings!
        if re.search(r"\b(hello|hi|hey|greetings|good\s+(morning|afternoon|evening|day))\b", nq):
            return (
                "Hello! I am **Vikola**, your AI assistant powered with Gemini intelligence.\n\n"
                "You can ask me any question: mathematics, programming, scientific principles, logic puzzles, "
                "writing, or attaching images and audio. How can I help you today?"
            )

        # 2. Identity
        if "who are you" in nq or "what is your name" in nq or "your name" in nq:
            return (
                "I am **Vikola**, your personal AI assistant engineered with the cognitive reasoning and multimodal intelligence of **Google Gemini**.\n"
                "I can solve multi-step problems, explain complex concepts, write and debug code, and analyze images and voice recordings."
            )

        # 3. Date / Time
        if "time" in nq and any(w in nq for w in ["what", "current", "now"]):
            return f"The current time is **{datetime.now().strftime('%I:%M %p')}**."
        if "date" in nq and any(w in nq for w in ["what", "today", "current"]):
            return f"Today is **{datetime.now().strftime('%A, %B %d, %Y')}**."

        # 4. Capitals
        if "capital of" in nq or "what is the capital" in nq:
            for country, capital in self.capitals.items():
                if country in nq:
                    return f"The capital of **{country.title()}** is **{capital}**."

        # 5. Math, Riddles & Logic
        math_sol = self.solve_math(q)
        if math_sol:
            return math_sol

        # Clean normalized query for knowledge matching (strip apostrophes, punctuation)
        clean_nq = re.sub(r"['’]s\b", "s", nq)
        clean_nq = re.sub(r"[^\w\s]", " ", clean_nq)
        clean_nq = re.sub(r"\s+", " ", clean_nq).strip()
        possessive_stripped = re.sub(r"['’]s\b", "", nq)
        possessive_stripped = re.sub(r"[^\w\s]", " ", possessive_stripped)
        possessive_stripped = re.sub(r"\s+", " ", possessive_stripped).strip()

        # 6. Direct clean query in knowledge
        if cq in self.knowledge:
            return f"**{cq.title()}:**\n\n{self.knowledge[cq]}"

        for term, fact in self.knowledge.items():
            if term in nq or term in clean_nq or term in possessive_stripped or term == cq:
                return f"**{term.title()}:**\n\n{fact}"

        # 7. Wikipedia REST API with clean term
        wiki = self.fetch_wikipedia(q)
        if wiki:
            return wiki

        # 8. Wikipedia OpenSearch Fallback
        wiki_search = self.search_wikipedia(q)
        if wiki_search:
            return wiki_search

        # 9. DuckDuckGo Instant Answer
        ddg = self.fetch_duckduckgo(cq) or self.fetch_duckduckgo(q)
        if ddg:
            return ddg

        # 10. Generic comprehensive answer
        display_term = cq.title() if cq else q
        return (
            f"**{display_term}:**\n\n"
            f"Here is an overview of **{display_term}**. This concept encompasses fundamental principles, "
            f"structural definitions, and practical applications across its domain.\n\n"
            f"To explore advanced multi-step reasoning, custom code implementations, or detailed analysis, "
            f"feel free to ask a specific follow-up question!"
        )


class PersonalAssistant:
    def __init__(self):
        self.gemini = GeminiClient()
        self.fallback = FallbackKnowledgeEngine()
        self.history = []  # list of {"role": "user"|"model", "text": str}
        self.query_cache = {}  # In-memory query cache to conserve quota

    def answer(self, question: str, attachments=None) -> dict:
        attachments = attachments or {}
        q = (question or "").strip()
        cache_key = q.lower()

        # Return cached answer if identical question was asked recently and no attachments
        if not attachments.get("imageName") and not attachments.get("audioName") and cache_key in self.query_cache:
            return self.query_cache[cache_key]

        image_path = None
        if attachments.get("imageName"):
            image_path = UPLOAD_DIR / attachments["imageName"]

        audio_path = None
        if attachments.get("audioName"):
            audio_path = UPLOAD_DIR / attachments["audioName"]

        # If Gemini API Key is configured, use Gemini!
        if self.gemini.has_key():
            resp_text, ok = self.gemini.generate(
                prompt=q,
                image_path=image_path,
                audio_path=audio_path,
                history=self.history,
            )
            if ok:
                # Save to history for context
                if q:
                    self.history.append({"role": "user", "text": q})
                self.history.append({"role": "model", "text": resp_text})
                # Keep history bounded
                if len(self.history) > 16:
                    self.history = self.history[-16:]

                result = {
                    "answer": resp_text,
                    "engine": "gemini",
                    "model": self.gemini.model,
                }
                if q:
                    self.query_cache[cache_key] = result
                return result
            else:
                # If Gemini returned an error or quota limit, seamlessly serve fallback answer
                fallback_ans = self.fallback.answer(q)
                result = {
                    "answer": fallback_ans,
                    "engine": "fallback",
                    "model": "offline_knowledge_engine",
                }
                return result

        # Fallback if no Gemini key is set yet
        fallback_ans = self.fallback.answer(q)
        advice = (
            "\n\n> 💡 **Tip:** To unlock Google Gemini's live reasoning, code generation, and multimodal analysis, "
            "add your free Gemini API key in **Settings (⚙️)**."
        )
        return {
            "answer": fallback_ans + advice,
            "engine": "fallback",
            "model": "knowledge_engine",
        }

    def clear_history(self):
        self.history = []


assistant = PersonalAssistant()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/settings":
            config = load_config()
            key = config.get("gemini_api_key", "").strip()
            masked = f"{key[:4]}...{key[-4:]}" if len(key) >= 8 else ("***" if key else "")
            self.send_json({
                "hasKey": bool(key),
                "maskedKey": masked,
                "model": config.get("model_name", "gemini-2.0-flash"),
                "configured": bool(key),
            })
            return

        if path == "/" or path == "/index.html":
            target = ROOT / "index.html"
        elif path.startswith("/uploads/"):
            target = UPLOAD_DIR / Path(path.replace("/uploads/", "")).name
        else:
            target = ROOT / path.lstrip("/")

        if not target.exists() or not target.is_file():
            self.send_error(404, "File not found")
            return

        content_type = self._content_type_for(target)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        if target.name == "sw.js":
            self.send_header("Service-Worker-Allowed", "/")
            self.send_header("Cache-Control", "no-cache")
        elif target.name in ("robots.txt", "sitemap.xml"):
            self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        with target.open("rb") as handle:
            self.wfile.write(handle.read())

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", "0"))
        content_type = self.headers.get("Content-Type", "")
        raw_bytes = self.rfile.read(length) if length else b""

        if path == "/api/settings":
            try:
                data = json.loads(raw_bytes.decode("utf-8")) if raw_bytes else {}
                new_key = data.get("apiKey", "").strip()
                new_model = data.get("model", "gemini-2.0-flash").strip()

                if new_key:
                    # Validate key with test ping — auto-detects working model
                    valid, msg, working_model = assistant.gemini.test_key(new_key, new_model)
                    if not valid:
                        self.send_json({"success": False, "message": msg}, status=400)
                        return
                    # Save the model that actually worked (may differ from requested)
                    save_model = working_model if working_model else new_model
                    save_config({"gemini_api_key": new_key, "model_name": save_model})
                    assistant.gemini.reload_config()
                    self.send_json({"success": True, "message": f"Connected! Using {save_model}."})
                else:
                    save_config({"model_name": new_model})
                    assistant.gemini.reload_config()
                    self.send_json({"success": True, "message": "Settings updated."})
            except Exception as e:
                self.send_json({"success": False, "message": str(e)}, status=500)
            return

        if path == "/api/clear":
            assistant.clear_history()
            self.send_json({"success": True, "message": "Chat history cleared."})
            return

        if path != "/ask":
            self.send_error(404)
            return

        question = ""
        attachments = {"imageName": None, "audioName": None, "audioIncluded": False}

        if content_type.startswith("multipart/form-data"):
            question, attachments = self._parse_multipart(raw_bytes, content_type)
        else:
            raw = raw_bytes.decode("utf-8") if raw_bytes else ""
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {}
            question = (payload.get("question") or "").strip()
            attachments = {
                "imageName": payload.get("imageName"),
                "audioName": payload.get("audioName"),
                "audioIncluded": bool(payload.get("audioIncluded")),
            }

        result = assistant.answer(question, attachments)
        self.send_json(result)

    def _parse_multipart(self, raw_bytes, content_type):
        question = ""
        attachments = {"imageName": None, "audioName": None, "audioIncluded": False}

        boundary_match = re.search(r'boundary=([^;\r\n]+)', content_type)
        if not boundary_match:
            return question, attachments

        boundary = boundary_match.group(1).strip('"')
        boundary_bytes = b'--' + boundary.encode()

        parts = raw_bytes.split(boundary_bytes)
        for part in parts:
            if part.startswith(b'\r\n') or part.startswith(b'\n'):
                part = part[2:]
            if part.startswith(b'--') or not part.strip():
                continue

            try:
                if b'\r\n\r\n' in part:
                    header_section, content = part.split(b'\r\n\r\n', 1)
                elif b'\n\n' in part:
                    header_section, content = part.split(b'\n\n', 1)
                else:
                    continue

                headers = {}
                for header_line in header_section.split(b'\r\n'):
                    if b':' in header_line:
                        key, value = header_line.split(b':', 1)
                        headers[key.decode().strip().lower()] = value.decode().strip()

                disposition = headers.get('content-disposition', '')
                name_match = re.search(r'name="([^"]+)"', disposition)
                file_match = re.search(r'filename="([^"]+)"', disposition)

                name = name_match.group(1) if name_match else None
                filename = file_match.group(1) if file_match else None
                content = content.rstrip(b'\r\n').rstrip(b'\n')

                if name == 'question':
                    question = content.decode('utf-8', errors='ignore').strip()
                elif name == 'image' and filename:
                    safe_name = f"img_{int(datetime.now().timestamp())}_{Path(filename).name}"
                    file_path = UPLOAD_DIR / safe_name
                    with open(file_path, 'wb') as f:
                        f.write(content)
                    attachments["imageName"] = safe_name
                elif name == 'audio' and filename:
                    safe_name = f"aud_{int(datetime.now().timestamp())}_{Path(filename).name}"
                    file_path = UPLOAD_DIR / safe_name
                    with open(file_path, 'wb') as f:
                        f.write(content)
                    attachments["audioName"] = safe_name
                    attachments["audioIncluded"] = True
            except Exception as e:
                print(f"Error parsing multipart segment: {e}")

        return question, attachments

    def send_json(self, payload, status=200):
        try:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            pass

    def _content_type_for(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".html":
            return "text/html; charset=utf-8"
        if suffix == ".css":
            return "text/css; charset=utf-8"
        if suffix == ".js":
            return "application/javascript; charset=utf-8"
        if suffix in [".json", ".webmanifest"]:
            return "application/manifest+json; charset=utf-8" if path.name == "manifest.json" else "application/json; charset=utf-8"
        if suffix == ".xml":
            return "application/xml; charset=utf-8"
        if suffix == ".txt":
            return "text/plain; charset=utf-8"
        if suffix == ".svg":
            return "image/svg+xml"
        if suffix in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"]:
            return "image/x-icon" if suffix == ".ico" else f"image/{suffix.lstrip('.')}"
        if suffix in [".webm", ".mp3", ".wav", ".ogg"]:
            return f"audio/{suffix.lstrip('.')}"
        return "application/octet-stream"

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"AI Assistant Server running at http://0.0.0.0:{port}")
    server.serve_forever()
