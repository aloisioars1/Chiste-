
import React, { useState, useEffect, useCallback } from 'react';
import { HumorTechnique, JokeBit, JokePart } from './types';
import { comedyAssistant } from './services/geminiService';

interface DiaryEntry {
  id: string;
  text: string;
  createdAt: number;
}

// Components
const SidebarItem: React.FC<{ icon: string; label: string; active?: boolean; onClick: () => void; shortcut?: string }> = ({ icon, label, active, onClick, shortcut }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
  >
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
    {shortcut && <span className="text-zinc-600 text-xs font-semibold">{shortcut}</span>}
  </button>
);

const HelpButton: React.FC<{ tip: string }> = ({ tip }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button 
        onClick={() => setShow(!show)}
        className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-500 hover:bg-amber-500/20 hover:text-amber-500 flex items-center justify-center text-[10px] font-bold transition-all border border-zinc-700"
        title="Ver dica"
      >
        ?
      </button>
      {show && (
        <div className="absolute left-0 top-7 w-64 p-3 bg-zinc-900 border border-amber-500/30 rounded-xl shadow-2xl z-20 animate-in fade-in zoom-in duration-200">
          <p className="text-[11px] text-zinc-300 leading-relaxed font-normal">{tip}</p>
          <div className="absolute -top-1.5 left-2 w-3 h-3 bg-zinc-900 border-l border-t border-amber-500/30 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

const ShareButton: React.FC<{ title: string; id: string }> = ({ title, id }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#${id}`;
    const shareData = {
      title: `Técnica de Comédia: ${title}`,
      text: `Confira esta técnica de stand-up no ComediaLab: ${title}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy!', err);
      }
    }
  };

  return (
    <button 
      onClick={handleShare}
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-amber-500 transition-colors bg-zinc-950/50 px-2 py-1 rounded border border-zinc-800"
      title="Compartilhar link desta técnica"
    >
      {copied ? '✅ Copiado' : (
        <>
          <span>🔗</span>
          <span>Compartilhar</span>
        </>
      )}
    </button>
  );
};

// Helper to count words
const countWords = (text: string) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'themes' | 'guide' | 'diary'>('editor');
  const [jokes, setJokes] = useState<JokeBit[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [newDiaryText, setNewDiaryText] = useState('');
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [selectedDiaryIds, setSelectedDiaryIds] = useState<Set<string>>(new Set());
  
  const [currentJoke, setCurrentJoke] = useState<Partial<JokePart & { tags: string; title: string }>>({
    title: '',
    premise: '',
    setup: '',
    punchline: '',
    tags: ''
  });
  const [selectedTechnique, setSelectedTechnique] = useState<HumorTechnique>(HumorTechnique.MISDIRECTION);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingIndex, setExpandingIndex] = useState<number | null>(null);
  const [expandedThemes, setExpandedThemes] = useState<Record<number, JokePart[]>>({});
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'refining' | 'success' | 'error'>('idle');
  const [themeIdeas, setThemeIdeas] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTechnique, setFilterTechnique] = useState<string>('all');
  const [speakingPart, setSpeakingPart] = useState<'premise' | 'setup' | 'punchline' | null>(null);
  const [speechProgress, setSpeechProgress] = useState(0); // New state for speech progress
  const [diarySearchTerm, setDiarySearchTerm] = useState(''); // New state for diary search

  // Local storage persistence
  useEffect(() => {
    const savedJokes = localStorage.getItem('comedia-lab-jokes');
    if (savedJokes) setJokes(JSON.parse(savedJokes));

    const savedDiary = localStorage.getItem('comedia-lab-diary');
    if (savedDiary) setDiaryEntries(JSON.parse(savedDiary));

    const savedSelectedDiaryIds = localStorage.getItem('comedia-lab-selected-diary-ids');
    if (savedSelectedDiaryIds) setSelectedDiaryIds(new Set(JSON.parse(savedSelectedDiaryIds)));
    else setSelectedDiaryIds(new Set()); // Initialize if not found


    // Handle direct links from URL hash
    const hash = window.location.hash;
    if (hash && hash.startsWith('#guide-')) {
      setActiveTab('guide');
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          element.classList.add('ring-2', 'ring-amber-500/50');
          setTimeout(() => element.classList.remove('ring-2', 'ring-amber-500/50'), 3000);
        }
      }, 500);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('comedia-lab-jokes', JSON.stringify(jokes));
  }, [jokes]);

  useEffect(() => {
    localStorage.setItem('comedia-lab-diary', JSON.stringify(diaryEntries));
  }, [diaryEntries]);
  
  useEffect(() => {
    localStorage.setItem('comedia-lab-selected-diary-ids', JSON.stringify(Array.from(selectedDiaryIds || [])));
  }, [selectedDiaryIds]);


  const saveJoke = useCallback(() => {
    if (!currentJoke.premise || !currentJoke.punchline) {
      alert('A premissa e o punchline são obrigatórios para salvar a piada!');
      return;
    }
    
    const tagList = currentJoke.tags 
      ? currentJoke.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') 
      : [];

    const newBit: JokeBit = {
      id: Date.now().toString(),
      title: currentJoke.title || (currentJoke.premise ? currentJoke.premise.slice(0, 30) + '...' : 'Bit sem título'),
      parts: {
        premise: currentJoke.premise || '',
        setup: currentJoke.setup || '',
        punchline: currentJoke.punchline || ''
      },
      technique: selectedTechnique,
      tags: tagList,
      createdAt: Date.now()
    };
    setJokes(prevJokes => [newBit, ...prevJokes]); // Use functional update
    setCurrentJoke({ title: '', premise: '', setup: '', punchline: '', tags: '' });
    setActiveTab('library');
  }, [currentJoke, selectedTechnique, setJokes, setCurrentJoke, setActiveTab]);

  const handleAddDiaryEntry = useCallback(() => {
    if (!newDiaryText.trim()) return;

    if (editingDiaryId) {
      setDiaryEntries(prevEntries => prevEntries.map(entry => 
        entry.id === editingDiaryId ? { ...entry, text: newDiaryText } : entry
      ));
      setEditingDiaryId(null);
    } else {
      const newEntry: DiaryEntry = {
        id: Date.now().toString(),
        text: newDiaryText,
        createdAt: Date.now(),
      };
      setDiaryEntries(prevEntries => [newEntry, ...prevEntries]); // Use functional update
    }
    setNewDiaryText('');
  }, [newDiaryText, editingDiaryId, setDiaryEntries, setNewDiaryText, setEditingDiaryId]);

  const handleEditDiaryEntry = useCallback((entry: DiaryEntry) => {
    setNewDiaryText(entry.text);
    setEditingDiaryId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setNewDiaryText, setEditingDiaryId]);

  const handleDeleteDiaryEntry = useCallback((id: string) => {
    setDiaryEntries(prevEntries => prevEntries.filter(entry => entry.id !== id)); // Use functional update
    setSelectedDiaryIds(prevSelected => { // Use functional update
      const newSelected = new Set(prevSelected);
      newSelected.delete(id);
      return newSelected;
    });
  }, [setDiaryEntries, setSelectedDiaryIds]);

  const toggleDiarySelection = useCallback((id: string) => {
    setSelectedDiaryIds(prevSelected => { // Use functional update
      const newSelected = new Set(prevSelected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  }, [setSelectedDiaryIds]);

  const handleBulkImport = useCallback(() => {
    if (selectedDiaryIds && selectedDiaryIds.size === 0) return;

    const selectedEntries = diaryEntries.filter(entry => selectedDiaryIds?.has(entry.id));
    const newBits: JokeBit[] = selectedEntries.map(entry => ({
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'Importado do Diário',
      parts: {
        premise: entry.text,
        setup: '',
        punchline: ''
      },
      technique: HumorTechnique.MISDIRECTION,
      tags: ['diário', 'rascunho'],
      createdAt: Date.now()
    }));

    setJokes(prevJokes => [...newBits, ...prevJokes]); // Use functional update
    setSelectedDiaryIds(new Set());
    setActiveTab('library');
    alert(`${newBits.length} ideias importadas como rascunhos para sua biblioteca!`);
  }, [selectedDiaryIds, diaryEntries, setJokes, setSelectedDiaryIds, setActiveTab]);

  const handleRefine = useCallback(async () => {
    if (!currentJoke.premise) {
      alert('A premissa é obrigatória para refinar a piada!');
      return;
    }
    setIsLoading(true);
    setFeedbackStatus('refining');
    try {
      const jokeToRefine: JokePart = {
        premise: currentJoke.premise || '',
        setup: currentJoke.setup || '',
        punchline: currentJoke.punchline || ''
      };
      const refined = await comedyAssistant.refineJoke(jokeToRefine, selectedTechnique);
      setCurrentJoke(prevJoke => ({ // Use functional update
        ...prevJoke,
        ...refined
      }));
      setFeedbackStatus('success');
      setTimeout(() => setFeedbackStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setFeedbackStatus('error');
      setTimeout(() => setFeedbackStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [currentJoke.premise, currentJoke.setup, currentJoke.punchline, selectedTechnique, setIsLoading, setFeedbackStatus, setCurrentJoke]);

  const handleExpandTheme = useCallback(async (theme: string, index: number) => {
    setExpandingIndex(index);
    try {
      const res = await comedyAssistant.expandTheme(theme);
      setExpandedThemes(prev => ({
        ...prev,
        [index]: res.suggestions
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setExpandingIndex(null);
    }
  }, [setExpandingIndex, setExpandedThemes]);

  const fetchThemes = useCallback(async (context?: string) => {
    setIsLoading(true);
    setExpandedThemes({});
    try {
      const res = await comedyAssistant.generateThemes(context);
      setThemeIdeas(res.ideas);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setExpandedThemes, setThemeIdeas]);

  // Web Speech API function
  const speakText = useCallback((text: string, partName: 'premise' | 'setup' | 'punchline') => {
    if ('speechSynthesis' in window && text.trim().length > 0) {
      window.speechSynthesis.cancel(); // Stop any current speech
      setSpeakingPart(partName); // Set the current speaking part
      setSpeechProgress(0); // Reset progress on new speech start

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR'; // Set language to Portuguese

      utterance.onboundary = (event) => {
        if (event.name === 'word' || event.name === 'sentence') {
          const progress = (event.charIndex / text.length) * 100;
          setSpeechProgress(Math.min(progress, 100)); // Ensure it doesn't exceed 100
        }
      };

      utterance.onend = () => {
        setSpeakingPart(null);
        setSpeechProgress(0); // Reset progress when speech ends
      };
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setSpeakingPart(null);
        setSpeechProgress(0); // Reset on error
      };

      window.speechSynthesis.speak(utterance);
    } else if (text.trim().length === 0) {
      // Do nothing if text is empty
      setSpeakingPart(null);
      setSpeechProgress(0);
    } else {
      alert('Seu navegador não suporta a API de Síntese de Fala.');
    }
  }, [setSpeakingPart, setSpeechProgress]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Navigation Shortcuts
      if (!e.repeat) { // Prevent multiple triggers on hold
        switch (e.key) {
          case '1': setActiveTab('editor'); e.preventDefault(); break;
          case '2': setActiveTab('library'); e.preventDefault(); break;
          case '3': setActiveTab('themes'); e.preventDefault(); break;
          case '4': setActiveTab('diary'); e.preventDefault(); break;
          case '5': setActiveTab('guide'); e.preventDefault(); break;
          default: break;
        }
      }

      // Action Shortcuts (only in relevant tabs)
      if (activeTab === 'editor') {
        if (isCtrlOrCmd && e.key === 's') {
          e.preventDefault(); // Prevent browser save dialog
          saveJoke();
        }
        if (isCtrlOrCmd && e.key === 'r') {
          e.preventDefault(); // Prevent browser refresh
          handleRefine();
        }
      } else if (activeTab === 'diary') {
        if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'i') {
          e.preventDefault(); // Prevent any default browser action
          if (selectedDiaryIds && selectedDiaryIds.size > 0) {
            handleBulkImport();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, selectedDiaryIds, saveJoke, handleRefine, handleBulkImport, setActiveTab]);


  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  // Filtered jokes based on search term and technique filter
  const filteredJokes = jokes.filter(joke => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term || (
      joke.title.toLowerCase().includes(term) ||
      joke.parts.premise.toLowerCase().includes(term) ||
      joke.parts.setup.toLowerCase().includes(term) ||
      joke.parts.punchline.toLowerCase().includes(term) ||
      joke.technique.toLowerCase().includes(term) ||
      joke.tags.some(tag => tag.toLowerCase().includes(term))
    );
    const matchesTechnique = filterTechnique === 'all' || joke.technique === filterTechnique;
    
    return matchesSearch && matchesTechnique;
  });

  // Filtered diary entries based on diarySearchTerm
  const filteredDiaryEntries = diaryEntries.filter(entry => {
    const term = diarySearchTerm.toLowerCase().trim();
    return !term || entry.text.toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-amber-500">ComediaLab</h1>
        <button className="text-2xl" onClick={() => {}}>☰</button>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 p-6 border-r border-zinc-900 space-y-8 h-screen sticky top-0">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            ComediaLab
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Writers Room</p>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon="✍️" label="Laboratório" active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} shortcut="1" />
          <SidebarItem icon="📚" label="Minhas Piadas" active={activeTab === 'library'} onClick={() => setActiveTab('library')} shortcut="2" />
          <SidebarItem icon="💡" label="Temas & Insights" active={activeTab === 'themes'} onClick={() => setActiveTab('themes')} shortcut="3" />
          <SidebarItem icon="📓" label="Diário de Ideias" active={activeTab === 'diary'} onClick={() => setActiveTab('diary')} shortcut="4" />
          <SidebarItem icon="📖" label="Guia de Técnicas" active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} shortcut="5" />
        </nav>

        <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
          <p className="text-sm text-zinc-400">"A tragédia é o que acontece comigo, a comédia é o que acontece com você."</p>
          <p className="text-xs text-zinc-600 mt-2 font-semibold">— Mel Brooks</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        
        {activeTab === 'editor' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <header className="space-y-2">
              <h2 className="text-3xl font-bold">Criar novo Bit</h2>
              <p className="text-zinc-400">Desenvolva sua piada passo a passo usando a inteligência do Gemini.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <section className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-between">
                      <label htmlFor="premise-textarea" className="text-sm font-semibold text-zinc-300">Premissa (A ideia central)</label>
                      <div className="flex items-center gap-2">
                        <span id="premise-word-count" className="text-xs text-zinc-500">{countWords(currentJoke.premise)} palavras</span>
                        <button 
                          onClick={() => speakText(currentJoke.premise || '', 'premise')} 
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ml-2 
                            ${speakingPart === 'premise' 
                              ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' 
                              : 'bg-zinc-800 text-zinc-500 hover:bg-amber-500/20 hover:text-amber-500 border-zinc-700'
                            }`}
                          title="Ouvir premissa"
                          aria-label="Ouvir premissa"
                        >
                          🔊
                        </button>
                        {speakingPart === 'premise' && (
                          <div className="relative w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                  className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-100 ease-linear"
                                  style={{ width: `${speechProgress}%` }}
                              ></div>
                          </div>
                        )}
                        <HelpButton tip="O assunto da piada. Algo que o público reconheça imediatamente. Foque em observações honestas sobre o cotidiano." />
                      </div>
                    </div>
                    <textarea 
                      id="premise-textarea"
                      value={currentJoke.premise}
                      onChange={(e) => setCurrentJoke({...currentJoke, premise: e.target.value})}
                      placeholder="Ex: Por que os apps de entrega cobram taxa de serviço se eu que tive que levantar pra pegar a comida?"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all h-24"
                      aria-describedby="premise-word-count"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-between">
                      <label htmlFor="setup-textarea" className="text-sm font-semibold text-zinc-300">Setup (O contexto/expectativa)</label>
                      <div className="flex items-center gap-2">
                        <span id="setup-word-count" className="text-xs text-zinc-500">{countWords(currentJoke.setup)} palavras</span>
                        <button 
                          onClick={() => speakText(currentJoke.setup || '', 'setup')} 
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ml-2 
                            ${speakingPart === 'setup' 
                              ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' 
                              : 'bg-zinc-800 text-zinc-500 hover:bg-amber-500/20 hover:text-amber-500 border-zinc-700'
                            }`}
                          title="Ouvir setup"
                          aria-label="Ouvir setup"
                        >
                          🔊
                        </button>
                        {speakingPart === 'setup' && (
                          <div className="relative w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                  className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-100 ease-linear"
                                  style={{ width: `${speechProgress}%` }}
                              ></div>
                          </div>
                        )}
                        <HelpButton tip="Prepara o público criando uma expectativa lógica ou suposição sólida. Não entregue a graça ainda, apenas construa o cenário." />
                      </div>
                    </div>
                    <textarea 
                      id="setup-textarea"
                      value={currentJoke.setup}
                      onChange={(e) => setCurrentJoke({...currentJoke, setup: e.target.value})}
                      placeholder="Onde isso acontece? Como você se sente?"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all h-24"
                      aria-describedby="setup-word-count"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-between">
                      <label htmlFor="punchline-textarea" className="text-sm font-semibold text-zinc-300">Punchline (O soco/surpresa)</label>
                      <div className="flex items-center gap-2">
                        <span id="punchline-word-count" className="text-xs text-zinc-500">{countWords(currentJoke.punchline)} palavras</span>
                        <button 
                          onClick={() => speakText(currentJoke.punchline || '', 'punchline')} 
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ml-2 
                            ${speakingPart === 'punchline' 
                              ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' 
                              : 'bg-zinc-800 text-zinc-500 hover:bg-amber-500/20 hover:text-amber-500 border-zinc-700'
                            }`}
                          title="Ouvir punchline"
                          aria-label="Ouvir punchline"
                        >
                          🔊
                        </button>
                        {speakingPart === 'punchline' && (
                          <div className="relative w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                  className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-100 ease-linear"
                                  style={{ width: `${speechProgress}%` }}
                              ></div>
                          </div>
                        )}
                        <HelpButton tip="O momento da quebra. Revele uma reinterpretação inesperada do setup que faça sentido mas surpreenda." />
                      </div>
                    </div>
                    <textarea 
                      id="punchline-textarea"
                      value={currentJoke.punchline}
                      onChange={(e) => setCurrentJoke({...currentJoke, punchline: e.target.value})}
                      placeholder="Qual é a quebra de expectativa?"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all h-24"
                      aria-describedby="punchline-word-count"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-300">Título do Bit</label>
                    <input 
                      type="text"
                      value={currentJoke.title}
                      onChange={(e) => setCurrentJoke({...currentJoke, title: e.target.value})}
                      placeholder="Ex: A saga do Wi-Fi lento"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-300">Tags (Separadas por vírgula)</label>
                    <input 
                      type="text"
                      value={currentJoke.tags}
                      onChange={(e) => setCurrentJoke({...currentJoke, tags: e.target.value})}
                      placeholder="Ex: comida, tecnologia, relacionamentos"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="technique-select" className="text-sm font-semibold text-zinc-400 block uppercase">Aplicar Técnica</label>
                    <select 
                      id="technique-select"
                      value={selectedTechnique}
                      onChange={(e) => setSelectedTechnique(e.target.value as HumorTechnique)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      {Object.values(HumorTechnique).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={handleRefine}
                    disabled={isLoading || !currentJoke.premise}
                    className={`w-full font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                      feedbackStatus === 'success' 
                      ? 'bg-green-600 text-white shadow-green-900/20' 
                      : feedbackStatus === 'error'
                      ? 'bg-red-600 text-white shadow-red-900/20'
                      : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                    } disabled:opacity-50`}
                    title="Atalho: Ctrl+R / Cmd+R"
                  >
                    {feedbackStatus === 'refining' ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                        <span>Refinando sua piada...</span>
                      </div>
                    ) : feedbackStatus === 'success' ? (
                      <span>✅ Piada refinada!</span>
                    ) : feedbackStatus === 'error' ? (
                      <span>❌ Erro ao refinar</span>
                    ) : (
                      '✨ Refinar com IA'
                    )}
                  </button>

                  <button 
                    onClick={saveJoke}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-3 rounded-xl transition-all"
                    title="Atalho: Ctrl+S / Cmd+S"
                  >
                    💾 Salvar no Caderno
                  </button>
                </div>

                <div className="p-4 border border-zinc-800 rounded-xl bg-zinc-900/30">
                  <h4 className="text-xs font-bold text-amber-500 uppercase mb-2">Dica Pro</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {selectedTechnique === HumorTechnique.GREG_DEAN ? "O segredo de Dean é o 'Conector': algo que pode ser interpretado de duas formas. O público escolhe a forma óbvia, e você revela a oculta." : 
                     selectedTechnique === HumorTechnique.LEO_LINS ? "Lins mapeia o assunto. Se o tema é 'Barbeiro', liste: tesoura, sangue, fofoca, espelho. Busque a conexão mais absurda entre esses pontos." :
                     "A técnica de Quebra de Expectativa funciona melhor quando o setup leva o público a um final óbvio, e você entrega algo totalmente diferente."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diary' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Diário de Ideias</h2>
                <p className="text-zinc-400">Capture pensamentos, observações do cotidiano e faíscas de inspiração.</p>
              </div>
              {selectedDiaryIds && selectedDiaryIds.size > 0 && (
                <button 
                  onClick={handleBulkImport}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 animate-in slide-in-from-right-2"
                  title="Atalho: Ctrl+Shift+I / Cmd+Shift+I"
                >
                  📥 Importar {selectedDiaryIds.size} {selectedDiaryIds.size === 1 ? 'ideia' : 'ideias'}
                </button>
              )}
            </header>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="space-y-4">
                <textarea 
                  value={newDiaryText}
                  onChange={(e) => setNewDiaryText(e.target.value)}
                  placeholder="Notei algo engraçado hoje no metrô..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all h-32 resize-none"
                />
                <div className="flex justify-end gap-3">
                  {editingDiaryId && (
                    <button 
                      onClick={() => {setEditingDiaryId(null); setNewDiaryText('');}}
                      className="px-6 py-2 rounded-xl text-zinc-400 hover:text-zinc-100 font-medium transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    onClick={handleAddDiaryEntry}
                    disabled={!newDiaryText.trim()}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold px-8 py-2 rounded-xl transition-all shadow-lg shadow-amber-900/20"
                  >
                    {editingDiaryId ? 'Atualizar Ideia' : 'Salvar Ideia'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-12">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Suas Notas ({filteredDiaryEntries.length} de {diaryEntries.length})</h3>
                 <div className="flex items-center gap-3">
                   {diaryEntries.length > 0 && (
                     <button 
                       onClick={() => {
                         if (selectedDiaryIds && selectedDiaryIds.size === diaryEntries.length) {
                           setSelectedDiaryIds(new Set());
                         } else {
                           setSelectedDiaryIds(new Set(diaryEntries.map(e => e.id)));
                         }
                       }}
                       className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase underline"
                     >
                       {selectedDiaryIds && selectedDiaryIds.size === diaryEntries.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                     </button>
                   )}
                   <div className="relative w-48 group">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 transition-colors">🔍</span>
                     <input 
                       type="text"
                       placeholder="Buscar no diário..."
                       value={diarySearchTerm}
                       onChange={(e) => setDiarySearchTerm(e.target.value)}
                       className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none transition-all placeholder:text-zinc-600"
                       aria-label="Campo de busca para diário de ideias"
                     />
                     {diarySearchTerm && (
                       <button 
                         onClick={() => setDiarySearchTerm('')}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-xs"
                         aria-label="Limpar termo de busca do diário"
                       >
                         Limpar
                       </button>
                     )}
                   </div>
                 </div>
              </div>
              
              {filteredDiaryEntries.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl">
                   <p className="text-zinc-500">
                     {diarySearchTerm.trim() !== '' 
                        ? 'Nenhuma ideia encontrada para o termo de busca.' 
                        : 'Nenhuma ideia anotada. Comece a observar o mundo!'}
                   </p>
                   {diarySearchTerm.trim() !== '' && (
                     <button 
                        onClick={() => setDiarySearchTerm('')}
                        className="mt-4 text-amber-500 text-sm font-bold hover:underline"
                        aria-label="Limpar busca do diário"
                     >
                        Limpar Busca
                     </button>
                   )}
                </div>
              ) : (
                filteredDiaryEntries.map(entry => (
                  <div 
                    key={entry.id} 
                    onClick={() => toggleDiarySelection(entry.id)}
                    className={`bg-zinc-900 border ${selectedDiaryIds && selectedDiaryIds.has(entry.id) ? 'border-amber-500 ring-1 ring-amber-500/20' : 'border-zinc-800'} p-6 rounded-2xl group hover:border-zinc-700 transition-all cursor-pointer relative`}
                  >
                    <div className="absolute top-6 left-6 -translate-x-12 opacity-0 group-hover:opacity-100 transition-all">
                       <input 
                         type="checkbox" 
                         checked={selectedDiaryIds && selectedDiaryIds.has(entry.id)}
                         onChange={() => toggleDiarySelection(entry.id)}
                         className="w-4 h-4 accent-amber-500"
                       />
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border ${selectedDiaryIds && selectedDiaryIds.has(entry.id) ? 'bg-amber-500 border-amber-500' : 'border-zinc-700'} flex items-center justify-center transition-colors`}>
                          {selectedDiaryIds && selectedDiaryIds.has(entry.id) && <span className="text-[10px] text-zinc-950">✓</span>}
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950 px-2 py-1 rounded">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleEditDiaryEntry(entry)}
                          className="text-xs text-zinc-400 hover:text-amber-500 font-medium"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteDiaryEntry(entry.id)}
                          className="text-xs text-zinc-400 hover:text-red-500 font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                    <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                    <div className="mt-4 flex gap-2" onClick={e => e.stopPropagation()}>
                       <button 
                        onClick={() => {
                          setCurrentJoke({ title: 'Da observação no diário', premise: entry.text, setup: '', punchline: '', tags: 'diário' });
                          setActiveTab('editor');
                        }}
                        className="text-[10px] uppercase font-bold text-amber-500/70 hover:text-amber-500 transition-colors"
                       >
                         ✨ Desenvolver esta ideia
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold">Minhas Piadas</h2>
                <p className="text-zinc-400">Você tem {filteredJokes.length} de {jokes.length} bits salvos.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <select 
                  value={filterTechnique}
                  onChange={(e) => setFilterTechnique(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/50 outline-none w-full sm:w-48 text-zinc-300 transition-all border-zinc-800 hover:border-zinc-700"
                  aria-label="Filtrar por técnica de humor"
                >
                  <option value="all">Todas as Técnicas</option>
                  {Object.values(HumorTechnique).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="relative w-full sm:w-64 group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 transition-colors">🔍</span>
                  <input 
                    type="text"
                    placeholder="Buscar em tudo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none transition-all placeholder:text-zinc-600"
                    aria-label="Campo de busca para piadas"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-xs"
                      aria-label="Limpar termo de busca"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jokes.length === 0 ? (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl">
                   <p className="text-zinc-500">Seu caderno está vazio. Comece a criar no Laboratório!</p>
                </div>
              ) : filteredJokes.length === 0 ? (
                <div className="col-span-full py-12 text-center border border-zinc-800 rounded-2xl animate-in fade-in zoom-in-95">
                   <p className="text-zinc-500">Nenhuma piada encontrada para os filtros atuais.</p>
                   <button 
                    onClick={() => {setSearchTerm(''); setFilterTechnique('all');}}
                    className="mt-4 text-amber-500 text-sm font-bold hover:underline"
                    aria-label="Limpar todos os filtros"
                   >
                     Limpar todos os filtros
                   </button>
                </div>
              ) : filteredJokes.map(joke => (
                <div key={joke.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl hover:border-amber-500/50 transition-all group animate-in fade-in duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase tracking-tighter text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                        {joke.technique}
                      </span>
                      {joke.tags && joke.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <button 
                      onClick={() => setJokes(jokes.filter(j => j.id !== joke.id))}
                      className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium"
                      aria-label={`Remover piada "${joke.title}"`}
                    >
                      Remover
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-amber-500 transition-colors">{joke.title}</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-zinc-300 font-medium leading-relaxed">{joke.parts.premise}</p>
                    {joke.parts.setup && <p className="text-zinc-400 italic bg-zinc-950/40 p-2 rounded border border-zinc-800/50">"{joke.parts.setup}"</p>}
                    {joke.parts.punchline && <p className="text-zinc-100 font-bold mt-2">→ {joke.parts.punchline}</p>}
                  </div>
                  <div className="mt-4 pt-4 border-t border-zinc-800/60 flex justify-between items-center text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                    <button 
                      onClick={() => {
                        setCurrentJoke({
                          title: joke.title,
                          premise: joke.parts.premise,
                          setup: joke.parts.setup,
                          punchline: joke.parts.punchline,
                          tags: joke.tags.join(', ')
                        });
                        setSelectedTechnique(joke.technique);
                        setActiveTab('editor');
                      }}
                      className="hover:text-amber-500 transition-colors flex items-center gap-1.5"
                      aria-label={`Refinar piada "${joke.title}" no Laboratório`}
                    >
                      <span>✏️</span>
                      <span>Refinar no Lab</span>
                    </button>
                    <span>{new Date(joke.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <header className="text-center space-y-4">
              <h2 className="text-4xl font-bold">Inspirador de Temas</h2>
              <p className="text-zinc-400 text-lg">Bloqueio criativo? Vamos desenterrar algo engraçado.</p>
              <div className="flex gap-2 max-w-lg mx-auto">
                <input 
                  type="text" 
                  placeholder="Contexto (ex: trabalho, casamento, academia)" 
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500"
                  id="contextInput"
                  aria-label="Contexto para gerar temas de piadas"
                />
                <button 
                  onClick={() => {
                    const input = document.getElementById('contextInput') as HTMLInputElement;
                    fetchThemes(input.value);
                  }}
                  className="bg-amber-600 px-6 py-3 rounded-lg font-bold hover:bg-amber-500 transition-colors"
                >
                  Gerar
                </button>
              </div>
            </header>

            {isLoading && (
              <div className="flex justify-center py-20">
                <div className="animate-pulse flex space-x-4">
                  <div className="rounded-full bg-zinc-800 h-10 w-10"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="h-2 bg-zinc-800 rounded"></div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-2 bg-zinc-800 rounded col-span-2"></div>
                        <div className="h-2 bg-zinc-800 rounded col-span-1"></div>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {themeIdeas.map((idea, idx) => (
                <div key={idx} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 hover:border-zinc-700 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span className="text-2xl mt-1">🔥</span>
                      <p className="text-xl font-bold text-zinc-100">{idea}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => handleExpandTheme(idea, idx)}
                        disabled={expandingIndex === idx}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                        aria-label={`Refinar tema "${idea}" com IA`}
                      >
                        {expandingIndex === idx ? <div className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" /> : '✨ Refinar com IA'}
                      </button>
                      <button 
                        onClick={() => {
                          setCurrentJoke({ title: '', premise: idea, setup: '', punchline: '', tags: '' });
                          setActiveTab('editor');
                        }}
                        className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 text-xs font-bold py-2 px-4 rounded-lg transition-colors border border-amber-500/30"
                        aria-label={`Escrever piada no Laboratório usando o tema "${idea}"`}
                      >
                        Escrever no Lab
                      </button>
                    </div>
                  </div>

                  {expandedThemes[idx] && (
                    <div className="pt-4 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {expandedThemes[idx].map((suggestion, sIdx) => (
                        <div key={sIdx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 text-sm flex flex-col">
                          <div className="flex-1 space-y-2">
                            <p className="text-amber-500 font-bold text-[10px] uppercase tracking-wider">Premissa {sIdx + 1}</p>
                            <p className="text-zinc-300 leading-snug">{suggestion.premise}</p>
                            <p className="text-zinc-500 italic text-xs">"{suggestion.setup}"</p>
                          </div>
                          <button 
                            onClick={() => {
                              setCurrentJoke({ 
                                title: idea, 
                                premise: suggestion.premise, 
                                setup: suggestion.setup, 
                                punchline: suggestion.punchline, 
                                tags: idea.toLowerCase().split(' ').slice(0, 2).join(',') 
                              });
                              setActiveTab('editor');
                            }}
                            className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 py-2 rounded-lg text-xs font-medium border border-zinc-800 transition-all mt-2"
                            aria-label={`Usar esta ideia para piada: "${suggestion.premise}"`}
                          >
                            Usar esta ideia
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto space-y-12 pb-20">
             <header className="space-y-2">
                <h2 className="text-3xl font-bold">Glossário da Comédia</h2>
                <p className="text-zinc-400">Domine as ferramentas que transformam observações em gargalhadas.</p>
             </header>

             <div className="grid gap-8">
               {/* Greg Dean Section */}
               <div id="guide-greg-dean" className="bg-amber-500/5 p-8 rounded-3xl border border-amber-500/20 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-amber-500 text-zinc-950 font-bold px-2 py-1 rounded text-xs">MÉTODO</span>
                      <h3 className="text-2xl font-bold text-amber-500">O Sistema Greg Dean</h3>
                    </div>
                    <ShareButton title="O Sistema Greg Dean" id="guide-greg-dean" />
                  </div>
                  <div className="space-y-4 text-zinc-300 leading-relaxed">
                    <p>O método mais técnico da comédia. Baseia-se em: <strong>Suposição</strong> (o que o público acha que vai acontecer) e <strong>Reinterpretação</strong> (o que realmente acontece).</p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400">
                      <li><strong>Conector:</strong> O elemento no setup que permite dois significados.</li>
                      <li><strong>Alvo:</strong> A suposição errada que o público faz.</li>
                    </ul>
                    <div className="mt-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 space-y-4">
                      <div>
                        <p className="mb-2"><em>"Eu gosto de fazer as pessoas sorrirem... Por isso eu trabalho em uma loja de gás hilariante."</em></p>
                        <p className="text-xs text-zinc-500">Conector: "fazer sorrir" (Suposição: carisma; Reinterpretação: efeito químico).</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"O meu avô morreu em paz, dormindo... Diferente dos passageiros do ônibus que ele estava dirigindo."</em></p>
                        <p className="text-xs text-zinc-500">Conector: "morreu em paz" (Suposição: fim de vida natural e calmo; Reinterpretação: negligência fatal).</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Eu perguntei para a minha namorada o que ela queria de aniversário. Ela disse: 'Algo com diamantes'. Então eu dei um baralho."</em></p>
                        <p className="text-xs text-zinc-500">Conector: "Algo com diamantes" (Suposição: joias caras; Reinterpretação: naipe de ouros de um baralho).</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Eu disse ao meu médico que quebrei meu braço em dois lugares. Ele me disse para parar de ir a esses lugares."</em></p>
                        <p className="text-xs text-zinc-500">Conector: "lugares" (Suposição: pontos anatômicos no corpo; Reinterpretação: localizações geográficas).</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Eu costumava vender enciclopédias de porta em porta... até que percebi que as pessoas preferiam que eu usasse a campainha."</em></p>
                        <p className="text-xs text-zinc-500">Conector: "de porta em porta" (Suposição: método de vendas domiciliar; Reinterpretação: ação física de bater na madeira da porta).</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Minha esposa me disse para abraçar meus erros. Então abracei ela."</em></p>
                        <p className="text-xs text-zinc-500">Conector: "erros" (Suposição: falhas; Reinterpretação: pessoa que representa os "erros").</p>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Leo Lins Section */}
               <div id="guide-leo-lins" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-zinc-700 text-zinc-100 font-bold px-2 py-1 rounded text-xs">ESTILO</span>
                      <h3 className="text-2xl font-bold text-zinc-100">Mapeamento (Leo Lins)</h3>
                    </div>
                    <ShareButton title="Mapeamento (Leo Lins)" id="guide-leo-lins" />
                  </div>
                  <div className="space-y-4 text-zinc-300 leading-relaxed">
                    <p>Técnica de exploração exaustiva. Antes de escrever a piada, você <strong>mapeia</strong> todos os substantivos, verbos e conceitos relacionados ao tema.</p>
                    <p className="text-sm">Ao mapear "Avião", você lista: <em>Poltrona, turbina, paraquedas, preço da coxinha, criança chorando, medo de cair.</em> A piada surge ao ligar dois pontos distantes desse mapa.</p>
                    <div className="mt-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 space-y-4">
                      <div>
                        <p className="mb-2"><em>"Viajar de avião é a única situação onde você paga caro para ficar preso em uma poltrona menor que a do seu carro e ainda reza para a 'turbulência' ser só o motorista bêbado."</em></p>
                        <p className="text-xs text-zinc-500">Mapa: Poltrona, Preço alto, Turbulência, Medo, Confinamento.</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"O casamento é o único contrato onde a cláusula de rescisão é 'morte'. Se você tentar colocar isso num contrato de aluguel, o corretor chama o hospício, mas no altar todo mundo joga arroz."</em></p>
                        <p className="text-xs text-zinc-500">Mapa: Contrato, Cláusula, Altar, Morte, Arroz, Rescisão.</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Ônibus lotado às 6 da manhã é um experimento social. É o único lugar onde você fica tão colado num desconhecido que, se ele espirrar, quem tem que limpar o nariz é você."</em></p>
                        <p className="text-xs text-zinc-500">Mapa: Lotação, Desconhecido, Higiene, Experimento, Contato físico.</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"O natal é a única época do ano que você aceita entrar na casa de estranhos vestidos de vermelho e pegar um presente. Se fosse em outra época, você chamaria a polícia e fugiria."</em></p>
                        <p className="text-xs text-zinc-500">Mapa: Natal, Estranhos, Roupa vermelha, Presentes, Invasão, Polícia.</p>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Standard Techniques */}
               <div id="guide-structure" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">1. Premissa, Setup e Punchline</h3>
                    <ShareButton title="Estrutura de Piada" id="guide-structure" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p><strong className="text-zinc-100">Premissa:</strong> É a ideia ou o tópico. Deve ser algo que o público entenda instantaneamente.</p>
                    <div className="mt-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p className="mb-2"><em>Exemplo: "Sempre que eu me sinto inútil, eu lembro que existe alguém que trabalha instalando setas em carros de luxo."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Eu odeio ir à academia. É o único lugar onde todo mundo está suando por um objetivo, mas você só quer ir para casa e comer pizza."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-callback" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">2. O Callback</h3>
                    <ShareButton title="Callback" id="guide-callback" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Referência a algo dito anteriormente no show.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p className="italic"><em>"Meu gato ainda acha que eu sou o cara que limpa a caixa de areia dele por hobbie."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>(Assumindo que antes foi falado sobre a dificuldade de usar tecnologia) "E por falar em senhas que nunca funcionam, meu novo roteador Wi-Fi é tão complicado que eu desisti e comecei a ler livros de novo."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-rule-of-three" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">3. Regra de Três</h3>
                    <ShareButton title="Regra de Três" id="guide-rule-of-three" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Padrão, padrão, quebra rítmica.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"As três coisas mais difíceis de dizer são: Eu te amo, eu sinto muito e Wor-ces-ter-shi-re sauce."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Existem três tipos de mentiras: mentiras, mentiras descaradas e currículos."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-pun" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">4. Trocadilho (Pun)</h3>
                    <ShareButton title="Trocadilho" id="guide-pun" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Exploração de múltiplos significados de uma palavra.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"Por que o café foi à delegacia? Porque ele foi expresso."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Por que o pato manco não podia jogar bola? Porque ele só conseguia fazer gol a coxear."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-irony" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">5. Ironia</h3>
                    <ShareButton title="Ironia" id="guide-irony" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Discrepância entre expectativa social e realidade.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"Adoro como as pessoas postam #gratidão enquanto estão xingando o motorista do lado no trânsito."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Minha academia tem um cartaz que diz 'Seja a mudança que você quer ver no mundo'. Eu só quero ver menos gordura no meu abdômen, mas ok."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-misdirection" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">6. Quebra de Expectativa</h3>
                    <ShareButton title="Quebra de Expectativa" id="guide-misdirection" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Conduzir o público a uma conclusão lógica e entregar um final inesperado.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"Ontem à noite um ladrão entrou em casa procurando dinheiro. Eu levantei da cama e começamos a procurar juntos."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Eu sou um homem de poucas palavras, mas sou muito bom em contar mentiras."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               {/* New Techniques */}
               <div id="guide-surprise" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">7. Surpresa</h3>
                    <ShareButton title="Surpresa" id="guide-surprise" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Introdução de um elemento totalmente inesperado que interrompe o fluxo lógico da narrativa.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"Minha esposa me disse que eu deveria ser mais carinhoso. Então agora eu abraço ela sempre que ela está lavando a louça. Ela odeia, mas eu me sinto um herói."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Eu estava andando na rua e vi um cara caindo de um prédio. Ele estava gritando, 'Não é o chão que me assusta, é a aterrissagem súbita!'"</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-dramatic-irony" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">8. Ironia Dramática</h3>
                    <ShareButton title="Ironia Dramática" id="guide-dramatic-irony" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Ocorre quando o público possui uma informação crucial que o personagem na piada desconhece, criando tensão cômica.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"O instrutor de paraquedismo gritando 'Não se preocupe, o reserva nunca falha!' enquanto ele mesmo esqueceu de vestir o próprio equipamento."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Meu chefe me deu um aumento e disse: 'Você é um funcionário valioso!'. Pena que ele não viu a minha simulação de como o sistema dele ia falhar na próxima semana."</em></p>
                      </div>
                    </div>
                  </div>
               </div>

               <div id="guide-sarcasm" className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 scroll-mt-20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-amber-500">9. Sarcasmo</h3>
                    <ShareButton title="Sarcasmo" id="guide-sarcasm" />
                  </div>
                  <div className="space-y-4 text-zinc-300">
                    <p>Uso de ironia para zombar, ridicularizar ou expressar desprezo, geralmente dizendo o oposto do que se quer dizer com um tom específico.</p>
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm">
                      <p><em>"Oh, você trabalha 14 horas por dia por um salário mínimo? Que vida incrível e equilibrada você tem. Eu adoraria ser um zumbi corporativo também."</em></p>
                      <div className="pt-4 border-t border-zinc-900">
                        <p className="mb-2"><em>"Ah, sim, porque nada diz 'eu sou um profissional sério' como uma reunião por vídeo com o seu gato andando na sua cabeça."</em></p>
                      </div>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
