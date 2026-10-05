import json
import sys
import threading
import time
import urllib.request
import urllib.error

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE = "http://127.0.0.1:8000"
TIMEOUT = 30

# Ensure backend server is running in background if not already started
try:
    urllib.request.urlopen(f"{BASE}/api/settings", timeout=1)
except Exception:
    import server
    server.ThreadingHTTPServer.allow_reuse_address = True
    _httpd = server.ThreadingHTTPServer(("127.0.0.1", 8000), server.Handler)
    _srv_thread = threading.Thread(target=_httpd.serve_forever, daemon=True)
    _srv_thread.start()
    time.sleep(1)

passed = 0
failed = 0
total = 0

def ask(question):
    payload = json.dumps({"question": question}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/ask",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "ExtendedTest/1.0"},
    )
    start = time.time()
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        elapsed = time.time() - start
        res = json.loads(resp.read().decode("utf-8"))
        return res, elapsed

def test(label, check_fn, question):
    global passed, failed, total
    total += 1
    print(f"\n[Test {total}] {label}")
    print(f"  Q: {question}")
    try:
        res, elapsed = ask(question)
        answer = res.get("answer", "")
        engine = res.get("engine", "?")
        model  = res.get("model", "?")
        ok = check_fn(answer)
        status = "✅ PASS" if ok else "⚠️  REVIEW"
        if ok:
            passed += 1
        else:
            failed += 1
        preview = answer[:200].replace("\n", " ")
        print(f"  Engine: {engine} | Model: {model} | Time: {elapsed:.2f}s | {status}")
        print(f"  A: {preview}{'...' if len(answer) > 200 else ''}")
    except Exception as e:
        failed += 1
        print(f"  ❌ ERROR: {e}")

def get_settings():
    req = urllib.request.Request(f"{BASE}/api/settings", headers={"User-Agent": "ExtendedTest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def clear_history():
    req = urllib.request.Request(
        f"{BASE}/api/clear",
        data=b"{}",
        headers={"Content-Type": "application/json", "User-Agent": "ExtendedTest/1.0"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

print("=" * 70)
print("🧪 Extended Vikola AI Chatbot Test Suite")
print("=" * 70)

# --- API Health Checks ---
print("\n>>> API Health Checks")
try:
    s = get_settings()
    print(f"  ✅ /api/settings OK — hasKey={s.get('hasKey')}, model={s.get('model')}")
except Exception as e:
    print(f"  ❌ /api/settings FAILED: {e}")

try:
    c = clear_history()
    print(f"  ✅ /api/clear OK — {c.get('message')}")
except Exception as e:
    print(f"  ❌ /api/clear FAILED: {e}")

# --- Subject Tests ---
test(
    "Greetings / Identity",
    lambda a: "vikola" in a.lower() or "gemini" in a.lower() or "assistant" in a.lower(),
    "What is your name and what can you do?"
)

test(
    "Simple Math Addition",
    lambda a: "7" in a,
    "What is 3 + 4?"
)

test(
    "Algebra",
    lambda a: "10" in a or "x = 10" in a.lower(),
    "Solve for x: 3x + 15 = 45"
)

test(
    "Python Palindrome Code",
    lambda a: "[::-1]" in a or "palindrome" in a.lower(),
    "Write a Python one-liner to check if a string is a palindrome."
)

test(
    "Science - Charles's Law",
    lambda a: "volume" in a.lower() and "temperature" in a.lower(),
    "State Charles's law in chemistry."
)

test(
    "Science - Boyle's Law",
    lambda a: "pressure" in a.lower() and ("volume" in a.lower() or "inversely" in a.lower()),
    "What is Boyle's law?"
)

test(
    "History & AI — Alan Turing",
    lambda a: "turing" in a.lower() and ("computer" in a.lower() or "enigma" in a.lower()),
    "Who was Alan Turing and why is he important?"
)

test(
    "Geography — Capitals",
    lambda a: "paris" in a.lower() and "tokyo" in a.lower(),
    "What is the capital of France and what is the capital of Japan?"
)

test(
    "Computer Science — List vs Tuple",
    lambda a: "mutable" in a.lower() or "immutable" in a.lower(),
    "What is the key difference between a list and a tuple in Python?"
)

test(
    "Logic Riddle — Machines & Widgets",
    lambda a: "5 minutes" in a.lower() or "5 min" in a.lower() or "five minutes" in a.lower(),
    "If 5 machines make 5 widgets in 5 minutes, how long do 100 machines take to make 100 widgets?"
)

test(
    "Astronomy — Why Moon doesn't fall",
    lambda a: "orbit" in a.lower() or "gravity" in a.lower() or "velocity" in a.lower(),
    "Why doesn't the moon fall into the earth?"
)

test(
    "Biology — Photosynthesis",
    lambda a: "light" in a.lower() and ("glucose" in a.lower() or "oxygen" in a.lower() or "co2" in a.lower()),
    "Explain the process of photosynthesis."
)

test(
    "Creative — Short poem",
    lambda a: len(a) > 50,
    "Write a short 4-line poem about the stars."
)

test(
    "Code generation — Fibonacci",
    lambda a: "fibonacci" in a.lower() or "def " in a or "fib" in a.lower(),
    "Write a Python function to compute the nth Fibonacci number."
)

test(
    "Edge Case — Empty-ish philosophical question",
    lambda a: len(a) > 20,
    "What is the meaning of life?"
)

# --- Summary ---
print("\n" + "=" * 70)
print(f"📊 Results: {passed}/{total} PASSED | {failed} NEED REVIEW")
print("=" * 70)
if passed == total:
    print("🎉 ALL TESTS PASSED!")
else:
    print(f"⚠️  {failed} test(s) need manual review.")
sys.exit(0 if failed == 0 else 1)
