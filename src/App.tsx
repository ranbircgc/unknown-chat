import { useState } from 'react';
import { ArrowRight, ArrowUpRight, ShieldCheck, Sparkles, MessageCircle, Users, LockKeyhole, Globe2, Heart, Zap, X, Flag, Ban, Send, ChevronLeft, Check, Shuffle, SlidersHorizontal } from 'lucide-react';

type Screen = 'home' | 'setup' | 'chat';
type Mode = 'random' | 'interests';

const interests = ['Technology', 'AI & ML', 'Gaming', 'Music', 'Movies', 'Anime', 'Travel', 'Food', 'Fitness', 'Books', 'Philosophy', 'Startups', 'Memes', 'Deep talks', 'Just bored'];

const starterMessages = [
  { from: 'them', text: 'Hey! What’s something you’ve been curious about lately?', time: 'Just now' },
  { from: 'me', text: 'Honestly, how people end up choosing completely different paths in life.', time: 'Just now' },
  { from: 'them', text: 'That’s a good one. I think a lot of it comes down to the people we meet.' , time: 'Just now' },
];

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>('random');
  const [selected, setSelected] = useState<string[]>(['Technology', 'Music']);
  const [language, setLanguage] = useState('Any language');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState<'report' | 'block' | null>(null);
  const [notice, setNotice] = useState('');

  const startSetup = (nextMode: Mode) => { setMode(nextMode); setScreen('setup'); window.scrollTo(0, 0); };
  const toggleInterest = (item: string) => setSelected(current => current.includes(item) ? current.filter(x => x !== item) : current.length < 5 ? [...current, item] : current);
  const enterDemo = () => {
    if (!ageConfirmed) { setNotice('Please confirm that you are 18 or older to continue.'); return; }
    if (mode === 'interests' && selected.length === 0) { setNotice('Choose at least one interest, or switch to random chat.'); return; }
    setNotice('');
    setMessages(starterMessages);
    setScreen('chat');
  };
  const sendMessage = () => {
    const value = draft.trim();
    if (!value) return;
    setMessages(current => [...current, { from: 'me', text: value.slice(0, 2000), time: 'Now' }]);
    setDraft('');
  };
  const nextDemo = () => { setMessages([{ from: 'them', text: 'Hi there. What brings you here today?', time: 'Just now' }]); setNotice('Demo only — live stranger matching is not connected yet.'); };
  const leaveChat = () => { setScreen('home'); setNotice(''); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen('home')} aria-label="UNKNOWN home"><span className="brand-mark">U</span><span>UNKNOWN<span className="brand-period">.</span></span></button>
        <nav className="nav-links"><a href="#how">How it works</a><a href="#safety">Your safety</a><a href="#about">About</a></nav>
        <button className="nav-cta" onClick={() => startSetup('random')}>Start talking <ArrowUpRight size={15}/></button>
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
          <p className="fine-print"><LockKeyhole size={12}/> This prototype does not verify age or connect to live users.</p>
        </div>
      </main>}

      {screen === 'chat' && <main className="chat-page">
        <div className="demo-banner"><span className="demo-pill">PROTOTYPE</span> This is a UI preview with simulated messages. Live matching is not connected.</div>
        <div className="chat-layout">
          <aside className="chat-sidebar"><button className="back-link" onClick={leaveChat}><ChevronLeft size={16}/> Exit chat</button><div className="sidebar-label">YOUR SESSION</div><div className="session-card"><div className="session-avatar">U</div><div><b>You are Unknown</b><small>Guest session · Temporary</small></div></div><div className="sidebar-label">YOUR PREFERENCES</div><div className="preference-line"><Globe2 size={15}/>{language}</div><div className="preference-line"><Sparkles size={15}/>{mode === 'random' ? 'Random matching' : selected.slice(0, 3).join(', ')}</div><div className="privacy-note"><LockKeyhole size={16}/><span><b>Keep it personal, not identifiable.</b><small>Don't share passwords, addresses, or financial details.</small></span></div></aside>
          <section className="chat-panel"><div className="chat-header"><div className="stranger-avatar">?</div><div className="stranger-info"><b>Someone new</b><small><span className="live-dot"/> Connected in demo</small></div><div className="chat-actions"><button title="Report" onClick={() => setModal('report')}><Flag size={16}/></button><button title="Block" onClick={() => setModal('block')}><Ban size={16}/></button><button className="next-button" onClick={nextDemo}><Shuffle size={14}/> Next stranger</button></div></div>
            <div className="message-area"><div className="chat-date">A NEW CONVERSATION</div><div className="conversation-hint">You both arrived as strangers.<br/>Keep it kind. Keep it curious.</div>{messages.map((m, i) => <div key={i} className={m.from === 'me' ? 'message-row mine' : 'message-row'}><div className="message-avatar">{m.from === 'me' ? 'U' : '?'}</div><div className="message-content"><div className="message-meta">{m.from === 'me' ? 'You' : 'Someone new'} <span>{m.time}</span></div><div className="message-bubble">{m.text}</div></div></div>)}</div>
            <div className="composer"><textarea value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Write something kind..." rows={1}/><span>{draft.length}/2000</span><button onClick={sendMessage} disabled={!draft.trim()} aria-label="Send message"><Send size={17}/></button></div><div className="chat-bottom-note"><LockKeyhole size={12}/> Never share sensitive personal information.</div>
          </section>
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
      </main>}

      <footer className="footer"><div className="footer-brand"><span className="brand-mark">U</span><b>UNKNOWN<span className="brand-period">.</span></b></div><span>Talk freely. Stay unknown.</span><div className="footer-links"><a href="#safety">Safety</a><a href="#about">Guidelines</a><a href="mailto:hello@unknown.example">Contact</a></div><small>© 2026 UNKNOWN. Built for better conversations.</small></footer>

      {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X size={18}/></button><div className="modal-icon">{modal === 'report' ? <Flag size={21}/> : <Ban size={21}/>}</div><h3>{modal === 'report' ? 'Report this conversation' : 'Block this person?'}</h3><p>{modal === 'report' ? 'Choose a reason. In the live product, this will be sent to the moderation team.' : 'In the live product, blocking will prevent this person from matching with you again.'}</p>{modal === 'report' ? <select className="report-select"><option>Harassment or bullying</option><option>Threats or violence</option><option>Hate speech</option><option>Sexual harassment or exploitation</option><option>Scam or spam</option><option>Sharing private information</option><option>Other</option></select> : <div className="block-warning">You can leave without explaining why.</div>}<div className="modal-actions"><button className="button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button-primary" onClick={() => { setModal(null); setNotice(modal === 'report' ? 'Demo only — reports are not submitted yet.' : 'Demo only — blocking is not connected yet.'); }}>{modal === 'report' ? 'Submit report' : 'Block & leave'}</button></div></div></div>}
    </div>
  );
}

export default App;