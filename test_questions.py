import json
import random
import sys
import time
import urllib.request

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

QUESTIONS = [
    {
        "category": "Math & Algebra",
        "question": "Solve for x: 3x + 15 = 45",
        "expected_check": lambda ans: "10" in ans or "x = 10" in ans.lower(),
    },
    {
        "category": "Logic & Riddle",
        "question": "If 5 machines make 5 widgets in 5 minutes, how long do 100 machines take to make 100 widgets?",
        "expected_check": lambda ans: "5 minutes" in ans.lower() or "5 min" in ans.lower(),
    },
    {
        "category": "Science & Astronomy",
        "question": "Why doesn't the moon fall into the earth?",
        "expected_check": lambda ans: "orbit" in ans.lower() or "gravity" in ans.lower() or "velocity" in ans.lower(),
    },
    {
        "category": "Computer Science & Coding",
        "question": "Write a Python one-liner to check if a string is a palindrome.",
        "expected_check": lambda ans: "[::-1]" in ans or "palindrome" in ans.lower(),
    },
    {
        "category": "Data Structures",
        "question": "What is the key difference between a list and a tuple in Python?",
        "expected_check": lambda ans: "mutable" in ans.lower() or "immutable" in ans.lower(),
    },
    {
        "category": "History & AI",
        "question": "Who was Alan Turing and why is he important?",
        "expected_check": lambda ans: "turing" in ans.lower() and ("enigma" in ans.lower() or "computer" in ans.lower() or "father" in ans.lower()),
    },
    {
        "category": "Science Laws",
        "question": "State Charles's law in chemistry.",
        "expected_check": lambda ans: "volume" in ans.lower() and "temperature" in ans.lower(),
    },
    {
        "category": "Geography & Facts",
        "question": "What is the capital of France and what is the capital of Japan?",
        "expected_check": lambda ans: "paris" in ans.lower() or "tokyo" in ans.lower(),
    }
]

def run_tests():
    url = "http://127.0.0.1:8000/ask"
    print("=" * 65)
    print("🧪 Running Automated Random Question Tests for Gemini Assistant")
    print("=" * 65)

    passed = 0
    total = len(QUESTIONS)

    # Shuffle to ensure random testing order
    random.shuffle(QUESTIONS)

    for idx, item in enumerate(QUESTIONS, 1):
        q = item["question"]
        cat = item["category"]
        print(f"\n[{idx}/{total}] Category: {cat}")
        print(f"❓ Question: {q}")

        payload = json.dumps({"question": q}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "TestClient/1.0"},
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                elapsed = time.time() - start_time
                res = json.loads(resp.read().decode("utf-8"))
                answer = res.get("answer", "")
                engine = res.get("engine", "unknown")

                # Verify expectation
                is_correct = item["expected_check"](answer)
                status_symbol = "✅ PASS" if is_correct else "⚠️ REVIEW"

                if is_correct:
                    passed += 1

                print(f"⏱️ Response Time: {elapsed:.2f}s | Engine: {engine} | Status: {status_symbol}")
                print("-" * 50)
                # Print clean snippet of the answer
                preview = answer[:280] + ("..." if len(answer) > 280 else "")
                print(preview)
                print("-" * 50)

        except Exception as e:
            print(f"❌ FAILED to query assistant: {e}")

    print("\n" + "=" * 65)
    print(f"📊 Test Results: {passed}/{total} Passed ({(passed/total)*100:.1f}%)")
    print("=" * 65)

    if passed == total:
        print("🎉 ALL TESTS PASSED! The AI answered every question accurately.")
        return 0
    else:
        print(f"⚠️ {total - passed} questions need review.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
