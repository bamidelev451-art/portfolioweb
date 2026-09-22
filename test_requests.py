import json, urllib.request
qs = ['What is an adjective?','define adjective','what is a noun','what is a program','what is Charles law','what is Boyle\'s law','What is Fitna?']
for q in qs:
    data = json.dumps({'question': q}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8000/ask', data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        r = json.load(resp)
    print('Q:', q)
    print('A:', r['answer'])
    print('---')
