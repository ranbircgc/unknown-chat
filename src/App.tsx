import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, ArrowRight, ArrowUpRight, ShieldCheck, Sparkles, MessageCircle, Users, LockKeyhole, Globe2, Heart, Zap, X, Flag, Ban, Send, ChevronLeft, Check, Shuffle, SlidersHorizontal } from 'lucide-react';

type Screen = 'home' | 'setup' | 'chat';
type Mode = 'random' | 'interests';

const interests = ['Technology', 'AI & ML', 'Gaming', 'Music', 'Movies', 'Anime', 'Travel', 'Food', 'Fitness', 'Books', 'Philosophy', 'Startups', 'Memes', 'Deep talks', 'Just bored'];

type ChatMessage = { from: 'me' | 'them'; text: string; time: string };
type ServerEvent = { type?: string; message?: string; text?: string; sentAt?: number; reason?: string; stranger?: { nickname?: string } };

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>('random');
  const [selected, setSelected] = useState<string[]>(['Technology', 'Music']);
  const [language, setLanguage] = useState('Any language');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'waiting' | 'connected' | 'error'>('idle');
  const [nickname, setNickname] = useState('Unknown');
  const socketRef = useRef<WebSocket | null>(null);
  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState<'report' | 'block' | null>(null);
  const [reportReason, setReportReason] = useState('Harassment or bullying');
  const [notice, setNotice] = useState('');
  const [chatStatus, setChatStatus] = useState('You both arrived as strangers. Keep it kind. Keep it curious.');
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('unknown-theme') as 'dark' | 'light') || 'dark');
  useEffect(() => { localStorage.setItem('unknown-theme', theme); }, [theme]);
  useEffect(() => {
    if (screen === 'home' && pendingSection) {
      document.getElementById(pendingSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingSection(null);
    }
  }, [screen, pendingSection]);
  const navigateSection = (section: string) => {
    if (screen === 'home') document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else { setPendingSection(section); setScreen('home'); }
  };

  const startSetup = (nextMode: Mode) => { setMode(nextMode); setScreen('setup'); window.scrollTo(0, 0); };
  const toggleInterest = (item: string) => setSelected(current => current.includes(item) ? current.filter(x => x !== item) : current.length < 5 ? [...current, item] : current);
  const connectSocket = (activeMode: Mode) => {
    socketRef.current?.close();
    setConnectionState('connecting');
    setMessages([]);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({ mode: activeMode, language, interests: selected.join(',') });
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/chat?${params.toString()}`);
    socketRef.current = socket;
    socket.onopen = () => setConnectionState('waiting');
    socket.onmessage = event => {
      let data: ServerEvent;
      try { data = JSON.parse(String(event.data)) as ServerEvent; } catch { return; }
      if (data.type === 'queue.waiting') {
        setConnectionState('waiting');
        setNotice('Looking for someone. Keep this page open.');
      } else if (data.type === 'match.found') {
        setConnectionState('connected');
        setChatStatus('You both arrived as strangers. Keep it kind. Keep it curious.');
        setNotice('');
      } else if (data.type === 'report.received') {
        setModal(null);
        setNotice(data.message || 'Report recorded. Leave the chat if you feel unsafe.');
      } else if (data.type === 'block.saved') {
        setModal(null);
        setConnectionState('waiting');
        setMessages([]);
        setDraft('');
        setChatStatus('You blocked this person. Finding someone else…');
        setNotice(data.message || 'This person is blocked for future matching.');
      } else if (data.type === 'session.replaced') {
        setConnectionState('error');
        setNotice(data.message || 'This guest session connected in another tab.');
      } else if (data.type === 'message.new') {
        setMessages(current => [...current, { from: 'them', text: data.text || '', time: data.sentAt ? new Date(data.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now' }]);
      } else if (data.type === 'room.closed') {
        setConnectionState('waiting');
        setMessages([]);
        const reason = data.reason || 'The conversation ended.';
        setChatStatus(reason + ' Finding your next stranger…');
        setDraft('');
        setNotice('Finding your next stranger…');
      } else if (data.type === 'error') {
        setNotice(data.message || 'Something went wrong.');
      }
    };
    socket.onerror = () => {
      setConnectionState('error');
      setNotice('Could not connect. Check that the backend and /api proxy are configured.');
    };
    socket.onclose = () => {
      if (socketRef.current === socket) setConnectionState('idle');
    };
  };

  const enterDemo = async () => {
    if (!ageConfirmed) { setNotice('Please confirm that you are 18 or older to continue.'); return; }
    if (mode === 'interests' && selected.length === 0) { setNotice('Choose at least one interest, or switch to random chat.'); return; }
    setScreen('chat');
    setConnectionState('connecting');
    setNotice('Creating your temporary guest session…');
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ageAttested: true }),
      });
      const payload = await response.json() as { session?: { nickname?: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not create a guest session.');
      setNickname(payload.session?.nickname || 'Unknown');
      setNotice('Session created. Finding a conversation…');
      connectSocket(mode);
    } catch (error) {
      setConnectionState('error');
      setNotice(error instanceof Error ? error.message : 'Backend unavailable. Configure the API proxy.');
    }
  };

  const sendMessage = () => {
    const value = draft.trim();
    if (!value || value.length > 2000) return;
    if (socketRef.current?.readyState !== WebSocket.OPEN || connectionState !== 'connected') {
      setNotice('You can send messages after a stranger connects.');
      return;
    }
    socketRef.current.send(JSON.stringify({ type: 'message.send', text: value }));
    setMessages(current => [...current, { from: 'me', text: value, time: 'Now' }]);
    setDraft('');
  };

  const nextDemo = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'room.end' }));
    connectSocket(mode);
  };

  const leaveChat = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'room.end' }));
    socketRef.current?.close();
    socketRef.current = null;
    setConnectionState('idle');
    setScreen('home');
    setNotice('');
  };

  useEffect(() => () => { socketRef.current?.close(); }, []);

  return (
    <div className={`app-shell ${theme === "light" ? "theme-light" : ""}`} data-theme={theme}>
      <header className="topbar">
        <button className="brand" onClick={() => { setScreen('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="UNKNOWN home"><img className="brand-logo" src={theme === "light" ? "/unknown-logo-light.svg" : "/unknown-logo.svg"} alt="UNKNOWN — Talk freely. Stay unknown." /></button>
        <nav className="nav-links"><a href="#how" onClick={e => { e.preventDefault(); navigateSection('how'); }}>How it works</a><a href="#safety" onClick={e => { e.preventDefault(); navigateSection('safety'); }}>Your safety</a><a href="#about" onClick={e => { e.preventDefault(); navigateSection('about'); }}>About</a></nav>
        <div className="topbar-actions"><button className="theme-toggle" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} aria-label="Toggle colour theme" title="Toggle colour theme">{theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button><button className="nav-cta" onClick={() => startSetup('random')}>Start talking <ArrowUpRight size={15}/></button></div>
      </header>

      {screen === 'home' && <main>
        <section className="hero">
          <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot"/> A DIFFERENT KIND OF CONNECTION</div>
            <h1>Strangers today.<br/><span>Stories tomorrow.</span></h1>
            <p className="hero-sub">A space to meet someone new, share a thought, or just talk. No profiles. No pressure. Just a conversation.</p>
            <div className="hero-actions">
              <button className="button-primary" onClick={() => startSetup('random')}>Meet a stranger <ArrowRight size={17}/></button>
              <button className="button-secondary" onClick={() => startSetup('interests')}><SlidersHorizontal size={16}/> Match by interests</button>
            </div>
            <div className="hero-foot"><span><LockKeyhole size={13}/> No public profile</span><span><Zap size={13}/> Leave anytime</span><span><ShieldCheck size={13}/> Safety controls</span></div>
          </div>
          <div className="hero-art" aria-label="Abstract conversation illustration">
            <div className="art-glow"/>
            <div className="chat-orb orb-a"><span className="orb-avatar">?</span><div><b>Someone new</b><small>Somewhere in the world</small></div><span className="orb-status"/></div>
            <div className="chat-orb orb-b"><span className="bubble-icon"><MessageCircle size={19}/></span><div><b>A fresh perspective</b><small>One conversation at a time</small></div></div>
            <div className="art-center"><div className="center-ring"><div className="center-core">U<span>.</span></div></div><span className="center-caption">THE UNKNOWN CONNECTION</span></div>
            <div className="floating-note note-a">“Hey, how’s your day going?”</div>
            <div className="floating-note note-b"><Sparkles size={13}/> No introductions needed</div>
            <div className="art-star star-a">✳</div><div className="art-star star-b">✦</div>
          </div>
        </section>

        <section className="trust-strip"><div><strong>01</strong><span>Arrive as you are</span></div><div><strong>02</strong><span>Find a conversation</span></div><div><strong>03</strong><span>Leave whenever you want</span></div></section>

        <section className="section how-section" id="how">
          <div className="section-heading"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>Less profile.<br/><span>More personality.</span></h2><p>Skip the performance of social media. Start with a conversation instead.</p></div>
          <div className="feature-grid">
            <article className="feature-card"><div className="feature-icon violet"><Shuffle size={20}/></div><span className="feature-number">01 / DISCOVER</span><h3>Random or by interest</h3><p>Meet someone unexpected, or find a person who shares what you love.</p></article>
            <article className="feature-card"><div className="feature-icon blue"><MessageCircle size={20}/></div><span className="feature-number">02 / CONNECT</span><h3>Just a conversation</h3><p>Text-first chats that let you focus on the person, not their profile.</p></article>
            <article className="feature-card"><div className="feature-icon green"><ShieldCheck size={20}/></div><span className="feature-number">03 / CONTROL</span><h3>Your boundaries matter</h3><p>Report, block, or move on. You decide when a conversation ends.</p></article>
          </div>
        </section>

        <section className="safety-section" id="safety"><div className="safety-visual"><div className="shield-back"><ShieldCheck size={66}/></div><div className="safety-chip chip-one"><LockKeyhole size={14}/> Private by design</div><div className="safety-chip chip-two"><Heart size={14}/> Respect is required</div></div><div className="safety-copy"><div className="eyebrow">A BETTER KIND OF ANONYMOUS</div><h2>Anonymous doesn't mean <span>anything goes.</span></h2><p>We want UNKNOWN to feel open, not unsafe. Clear community rules and visible safety tools are part of the experience—not an afterthought.</p><ul><li><Check size={16}/> 18+ community policy</li><li><Check size={16}/> Block and report controls</li><li><Check size={16}/> No public profiles or follower counts</li><li><Check size={16}/> Leave a conversation at any time</li></ul><a href="#about" className="text-link">Our approach to safety <ArrowUpRight size={15}/></a></div></section>

        <section className="closing-cta" id="about"><div className="closing-spark">✳</div><div className="eyebrow">THE NEXT CONVERSATION IS OUT THERE</div><h2>Say hello to<br/><span>the unexpected.</span></h2><button className="button-primary" onClick={() => startSetup('random')}>Start a conversation <ArrowRight size={17}/></button><p>Talk freely. Stay unknown.</p></section>
      </main>}

      {screen === 'setup' && <main className="flow-wrap">
        <button className="back-link" onClick={() => setScreen('home')}><ChevronLeft size={16}/> Back to home</button>
        <div className="flow-card">
          <div className="eyebrow"><span className="live-dot"/> YOUR NEXT CONVERSATION</div>
          <h1>How would you<br/><span>like to connect?</span></h1>
          <p className="flow-intro">Choose your way in. You can change it anytime.</p>
          <div className="mode-switch">
            <button className={mode === 'random' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('random')}><Shuffle size={18}/><b>Surprise me</b><small>Meet someone at random</small></button>
            <button className={mode === 'interests' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('interests')}><Sparkles size={18}/><b>Find my people</b><small>Match around shared interests</small></button>
          </div>
          {mode === 'interests' && <div className="interest-picker"><div className="picker-heading"><b>What are you into?</b><small>Pick up to 5 interests</small></div><div className="interest-list">{interests.map(item => <button key={item} className={selected.includes(item) ? 'interest selected' : 'interest'} onClick={() => toggleInterest(item)}>{selected.includes(item) && <Check size={12}/>} {item}</button>)}</div></div>}
          <label className="select-label">Conversation language<select value={language} onChange={e => setLanguage(e.target.value)}><option>Any language</option><option>English</option><option>Hindi</option><option>Hinglish</option></select></label>
          <label className="age-check"><input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)}/><span>I confirm that I am 18 years of age or older.</span></label>
          {notice && <p className="inline-notice">{notice}</p>}
          <button className="button-primary full-button" onClick={enterDemo}>Continue <ArrowRight size={17}/></button>
          <p className="fine-print"><LockKeyhole size={12}/> Age confirmation is self-attestation, not age verification.</p>
        </div>
      </main>}

      {screen === 'chat' && <main className="chat-page">
        <div className="demo-banner"><span className="demo-pill">{connectionState.toUpperCase()}</span> {connectionState === "waiting" ? "Waiting for another person to join…" : connectionState === "connected" ? "You are connected. Be respectful and protect your privacy." : connectionState === "error" ? "Connection unavailable." : "Connecting to UNKNOWN chat…"}</div>
        <div className="chat-layout">
          <aside className="chat-sidebar"><button className="back-link" onClick={leaveChat}><ChevronLeft size={16}/> Exit chat</button><div className="sidebar-label">YOUR SESSION</div><div className="session-card"><div className="session-avatar">U</div><div><b>You are {nickname}</b><small>Guest session · Temporary</small></div></div><div className="sidebar-label">YOUR PREFERENCES</div><div className="preference-line"><Globe2 size={15}/>{language}</div><div className="preference-line"><Sparkles size={15}/>{mode === 'random' ? 'Random matching' : selected.slice(0, 3).join(', ')}</div><div className="privacy-note"><LockKeyhole size={16}/><span><b>Keep it personal, not identifiable.</b><small>Don't share passwords, addresses, or financial details.</small></span></div></aside>
          <section className="chat-panel"><div className="chat-header"><div className="stranger-avatar">?</div><div className="stranger-info"><b>Someone new</b><small><span className="live-dot"/> {connectionState === "connected" ? "Connected" : connectionState === "waiting" ? "Finding a stranger" : "Connecting"}</small></div><div className="chat-actions"><button title="Report" onClick={() => setModal('report')}><Flag size={16}/></button><button title="Block" onClick={() => setModal('block')}><Ban size={16}/></button><button className="next-button" onClick={nextDemo}><Shuffle size={14}/> Next stranger</button></div></div>
            <div className="message-area"><div className="chat-date">A NEW CONVERSATION</div><div className="conversation-hint">{chatStatus}</div>{messages.map((m, i) => <div key={i} className={m.from === 'me' ? 'message-row mine' : 'message-row'}><div className="message-avatar">{m.from === 'me' ? 'U' : '?'}</div><div className="message-content"><div className="message-meta">{m.from === 'me' ? 'You' : 'Someone new'} <span>{m.time}</span></div><div className="message-bubble">{m.text}</div></div></div>)}</div>
            <div className="composer"><textarea value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Write something kind..." rows={1}/><span>{draft.length}/2000</span><button onClick={sendMessage} disabled={!draft.trim()} aria-label="Send message"><Send size={17}/></button></div><div className="chat-bottom-note"><LockKeyhole size={12}/> Never share sensitive personal information.</div>
          </section>
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
      </main>}

      <footer className="footer"><div className="footer-brand"><img className="brand-logo footer-logo" src={theme === "light" ? "/unknown-logo-light.svg" : "/unknown-logo.svg"} alt="UNKNOWN — Talk freely. Stay unknown." /></div><span>Talk freely. Stay unknown.</span><div className="footer-links"><a href="#safety" onClick={e => { e.preventDefault(); navigateSection('safety'); }}>Safety</a><a href="#about" onClick={e => { e.preventDefault(); navigateSection('about'); }}>Guidelines</a><a href="mailto:hello@unknown.example">Contact</a></div><small>© 2026 UNKNOWN. Built for better conversations.</small></footer>

      {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X size={18}/></button><div className="modal-icon">{modal === 'report' ? <Flag size={21}/> : <Ban size={21}/>}</div><h3>{modal === 'report' ? 'Report this conversation' : 'Block this person?'}</h3><p>{modal === 'report' ? 'Choose the main reason. We store the report reason and session references, not chat messages.' : 'This person will be blocked for the rest of your current guest session.'}</p>{modal === 'report' ? <select className="report-select" value={reportReason} onChange={e => setReportReason(e.target.value)}><option>Harassment or bullying</option><option>Threats or violence</option><option>Hate speech</option><option>Sexual harassment or exploitation</option><option>Scam or spam</option><option>Sharing private information</option><option>Other</option></select> : <div className="block-warning">You can leave without explaining why.</div>}<div className="modal-actions"><button className="button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button-primary" onClick={() => { if (socketRef.current?.readyState !== WebSocket.OPEN || connectionState !== 'connected') { setModal(null); setNotice('There is no active conversation.'); return; } socketRef.current.send(JSON.stringify(modal === 'report' ? { type: 'report.submit', reason: reportReason } : { type: 'block.add' })); setNotice(modal === 'report' ? 'Submitting report…' : 'Blocking this person…'); if (modal === 'block') setModal(null); }}>{modal === 'report' ? 'Submit report' : 'Block & leave'}</button></div></div></div>}
    </div>
  );
}

export default App;