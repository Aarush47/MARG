import React, { useEffect, useRef, useState } from 'react';

const VoiceAssistant = ({ 
  onCommand 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    // Only works in Chrome/Edge (webkit), but perfect for demos
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Removed strict en-US so it defaults to OS language and can handle Hinglish better natively
    let permissionDenied = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      if (finalTranscript) {
        const text = finalTranscript.toLowerCase().trim();
        onCommandRef.current(text);
        
        // Clear text after a short delay so UI resets
        setTimeout(() => setTranscript(''), 2000);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        permissionDenied = true;
        setIsListening(false);
        return;
      }

      console.error("Speech recognition error", event.error);
      if (event.error === 'no-speech' || event.error === 'network') {
        try { recognition.start(); } catch(e){}
      }
    };

    recognition.onend = () => {
      if (permissionDenied) {
        setIsListening(false);
        return;
      }

      try {
        recognition.start();
      } catch(e) {
        setIsListening(false);
      }
    };

    // Auto-start on mount (when user logs in)
    try {
      recognition.start();
    } catch(e) {}

    return () => {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.stop();
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '12px 24px',
      borderRadius: '30px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      color: 'white',
      zIndex: 9999,
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: isListening ? '#00C851' : '#ff4444',
        boxShadow: isListening ? '0 0 10px #00C851' : 'none',
        animation: isListening ? 'pulse 1.5s infinite' : 'none'
      }} />
      <div style={{ fontFamily: 'monospace', fontSize: '14px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {transcript ? `"${transcript}"` : (isListening ? 'Listening for commands...' : 'Voice Assistant Off')}
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistant;
