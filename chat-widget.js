(function() {
  // Generate UUID for session
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get or create session ID
  let sessionId = sessionStorage.getItem('riverChatSession');
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem('riverChatSession', sessionId);
  }

  // Initialize conversation history and lead data
  let conversationHistory = [];
  let leadData = JSON.parse(localStorage.getItem('riverLeadData')) || { name: '', email: '' };
  let leadCaptured = leadData.name && leadData.email;
  let messageCount = 0;

  // Create chat widget HTML
  const widgetHTML = `
    <div id="river-chat-widget">
      <button id="river-chat-button" aria-label="Open chat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C10.298 22 8.695 21.575 7.287 20.822L2 22L3.178 16.713C2.425 15.305 2 13.702 2 12C2 6.477 6.477 2 12 2ZM13 7H11V13H17V11H13V7Z" fill="white"/>
        </svg>
      </button>
      
      <div id="river-chat-window" style="display: none;">
        <div class="river-chat-header">
          <h3>River - Red River AI Assistant</h3>
          <button id="river-chat-close" aria-label="Close chat">×</button>
        </div>
        
        <div id="river-chat-messages">
          <div class="river-message bot">
            <p>Hi! I'm River, your AI assistant. I'm here to help you learn about Red River AI's services. How can I help you today?</p>
          </div>
        </div>
        
        <div class="river-chat-input-container">
          <input 
            type="text" 
            id="river-chat-input" 
            placeholder="Type your message..." 
            aria-label="Chat message input"
          />
          <button id="river-chat-send" aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="#B22020"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  // Add widget to page
  document.body.insertAdjacentHTML('beforeend', widgetHTML);

  // Get elements
  const chatButton = document.getElementById('river-chat-button');
  const chatWindow = document.getElementById('river-chat-window');
  const closeButton = document.getElementById('river-chat-close');
  const messagesContainer = document.getElementById('river-chat-messages');
  const chatInput = document.getElementById('river-chat-input');
  const sendButton = document.getElementById('river-chat-send');

  // Toggle chat window
  chatButton.addEventListener('click', () => {
    chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
    if (chatWindow.style.display === 'flex') {
      chatInput.focus();
    }
  });

  closeButton.addEventListener('click', () => {
    chatWindow.style.display = 'none';
  });

  // Add message to chat
  function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `river-message ${isUser ? 'user' : 'bot'}`;
    
    const messageP = document.createElement('p');
    messageP.textContent = content;
    messageDiv.appendChild(messageP);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show typing indicator
  function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'river-message bot typing';
    typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return typingDiv;
  }

  // Send message to webhook
  async function sendMessage(message) {
    // Add to history
    conversationHistory.push({ role: 'user', content: message });
    messageCount++;

    // Show typing indicator
    const typingIndicator = showTypingIndicator();

    try {
      const response = await fetch('https://automatemybuisness.oph.st/webhook/river-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer d869f45e4a6c6399b0a033f013d67d17aeee91cc95308c2143f3955c7e605511'
        },
        body: JSON.stringify({
          message: message,
          history: conversationHistory,
          sessionId: sessionId,
          leadData: leadData
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      // Remove typing indicator
      typingIndicator.remove();
      
      // Add bot response
      addMessage(data.reply);
      conversationHistory.push({ role: 'assistant', content: data.reply });

      // Check for lead capture opportunity
      if (!leadCaptured && messageCount >= 3) {
        checkForLeadCapture(data.reply);
      }

    } catch (error) {
      console.error('Error:', error);
      typingIndicator.remove();
      addMessage('River is unavailable right now, try again soon.');
    }
  }

  // Check if we should capture lead data
  function checkForLeadCapture(botMessage) {
    // Check if bot is asking for contact info
    if (botMessage.toLowerCase().includes('email') || botMessage.toLowerCase().includes('name') || botMessage.toLowerCase().includes('contact')) {
      // Lead capture will happen naturally through conversation
      return;
    }
    
    // If not already asking, have River naturally ask for contact info
    if (!leadCaptured && messageCount === 3) {
      setTimeout(() => {
        const typingIndicator = showTypingIndicator();
        setTimeout(() => {
          typingIndicator.remove();
          addMessage("By the way, I'd love to stay in touch! Could you share your name and email so I can send you more information about our services?");
          conversationHistory.push({ 
            role: 'assistant', 
            content: "By the way, I'd love to stay in touch! Could you share your name and email so I can send you more information about our services?" 
          });
        }, 1000);
      }, 2000);
    }
  }

  // Extract lead data from messages
  function extractLeadData(message) {
    // Simple email regex
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = message.match(emailRegex);
    
    if (emailMatch && !leadData.email) {
      leadData.email = emailMatch[0];
    }
    
    // Simple name extraction (looks for "I'm", "I am", "My name is", etc.)
    const namePatterns = [
      /(?:i'm|i am|my name is|name is|call me)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/  // Just a capitalized name
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = message.match(pattern);
      if (nameMatch && !leadData.name) {
        leadData.name = nameMatch[1].trim();
        break;
      }
    }
    
    // Save lead data if we have both
    if (leadData.name && leadData.email) {
      leadCaptured = true;
      localStorage.setItem('riverLeadData', JSON.stringify(leadData));
    }
  }

  // Handle send button click
  sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
      addMessage(message, true);
      extractLeadData(message);
      sendMessage(message);
      chatInput.value = '';
    }
  });

  // Handle enter key
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });

  // Mobile responsive adjustments
  function adjustForMobile() {
    if (window.innerWidth <= 768) {
      chatWindow.style.width = '100%';
      chatWindow.style.height = '100%';
      chatWindow.style.bottom = '0';
      chatWindow.style.right = '0';
      chatWindow.style.borderRadius = '0';
    }
  }

  window.addEventListener('resize', adjustForMobile);
  adjustForMobile();
})();