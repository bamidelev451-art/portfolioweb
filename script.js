const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

function addMessage(text, sender) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${sender}`;
  messageEl.textContent = text;
  chatBox.appendChild(messageEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function generateReply(question) {
  try {
    const response = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await response.json();
    return data.answer || 'I could not generate a response right now.';
  } catch (error) {
    return 'The assistant is temporarily unavailable. Please try again in a moment.';
  }
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = userInput.value.trim();
  if (!question) return;

  addMessage(question, 'user');
  userInput.value = '';
  addMessage('Thinking...', 'bot');

  const reply = await generateReply(question);
  chatBox.removeChild(chatBox.lastChild);
  addMessage(reply, 'bot');
});

addMessage('Welcome! Ask me a question and I will help you get started.', 'bot');
