import React, { useEffect, useState } from 'react';
import { Lock, Search, Edit, MessageCircle, CheckCircle, XCircle, Play, Zap, Settings, Pin, Users, Megaphone, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui';
import { getChats } from '../lib/mock/mockServices';
import { FEATURE_FLAGS } from '../lib/config/featureFlags';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getMessageRequests, acceptRequest, declineRequest } from '../lib/mock/mockSocialGraph';
import { mockUsers } from '../lib/mock/mockData';
import { BadgeRow } from '../components/BadgeComponents';
import { generateMockStatsForBadge } from '../lib/mock/mockBadges';
import { useWindowDimensions } from '../hooks/useWindowDimensions';
import { getBond, MOCK_BONDS } from '../lib/bondEngine';
import { BondIcon } from '../components/BondIcon';
import { GroupCreateFlow } from '../components/GroupCreateFlow';
import { MOCK_CHATS } from '../lib/mock/mockChatDirectory';


function SwipeableChatRow({ chat, onClick }: { chat: any, onClick: any, key?: React.Key }) {
    const navigate = useNavigate();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [dragX, setDragX] = useState(0);
   
    const getReadReceiptIcon = (lastMessage: string, unread: number) => {
        if (unread > 0) return null;
        if (lastMessage.startsWith('You:')) {
            return <span className="text-neon-blue text-[10px] ml-1 opacity-80 shrink-0 select-none tracking-tight">✓✓</span>;
        }
        return null;
    };

    return (
        <div className="group relative overflow-hidden bg-[#0A0A12]">
            {/* Background Actions (Underneath the row) */}
            <div className="absolute inset-0 flex justify-between items-center px-4">
                {/* Left Action (Swipe Right) */}
                <div className={`flex items-center text-blue-400 transition-opacity ${dragX > 20 ? 'opacity-100' : 'opacity-0'}`}>
                    <MessageCircle className="w-5 h-5 mr-2" />
                    <span className="text-xs font-bold">Reply</span>
                </div>
                
                {/* Right Actions (Swipe Left) */}
                <div className={`flex items-center gap-4 text-gray-300 transition-opacity ${dragX < -20 ? 'opacity-100' : 'opacity-0'}`}>
                    <button className="flex flex-col items-center gap-1 hover:text-white transition group/action pointer-events-auto">
                        <div className="bg-white/10 w-9 h-9 rounded-full flex items-center justify-center group-hover/action:bg-white/20">
                            <span className="text-sm">🔕</span>
                        </div>
                    </button>
                    <button className="flex flex-col items-center gap-1 hover:text-white transition group/action pointer-events-auto">
                        <div className="bg-[#B026FF]/20 w-9 h-9 rounded-full flex items-center justify-center group-hover/action:bg-[#B026FF]/40 text-[#B026FF]">
                            <Pin className="w-4 h-4" />
                        </div>
                    </button>
                    <button className="flex flex-col items-center gap-1 hover:text-white transition group/action pointer-events-auto">
                        <div className="bg-red-500/20 w-9 h-9 rounded-full flex items-center justify-center group-hover/action:bg-red-500/40 text-red-500">
                            <span className="text-sm">🗑️</span>
                        </div>
                    </button>
                    <button className="flex flex-col items-center gap-1 text-gray-300 hover:text-white transition group/action pointer-events-auto">
                        <div className="bg-white/10 w-9 h-9 rounded-full flex items-center justify-center group-hover/action:bg-white/20">
                            <span className="text-sm">📁</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Draggable Top Layer */}
            <motion.div 
                className={`flex items-center gap-3 px-4 py-3 relative z-10 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] bg-[#0A0A12] ${chat.pinned ? 'bg-[#B026FF]/[0.03]' : ''} ${isMobile ? '' : 'cursor-pointer'}`}
                drag="x"
                dragConstraints={{ left: -220, right: 80 }}
                dragElastic={0.1}
                onDrag={(_, info) => setDragX(info.offset.x)}
                onDragEnd={(_, info) => {
                    const offset = info.offset.x;
                    if (offset > 50) {
                        // Quick Reply threshold
                        onClick(); // open chat in quick mode ideally
                    } else if (offset < -100) {
                        // Keep open or do something - for now just snapping back handled by animation config
                    } else {
                        setDragX(0); // if not moved enough
                    }
                }}
                whileDrag={{ scale: 1.01, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", zIndex: 20 }}
                onClick={onClick}
                style={{ touchAction: 'pan-y' }}
            >
                {/* Avatar Area */}
                <div 
                    className={`relative shrink-0 w-12 h-12 ${!chat.isGroup && chat.username ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    onClick={(e) => {
                        if (!chat.isGroup && chat.username) {
                            e.stopPropagation();
                            navigate(`/profile/${chat.username}`);
                        }
                    }}
                >
                    {chat.isGroup ? (
                        <div className="relative w-full h-full">
                            <img src={chat.avatar2} className="w-8 h-8 rounded-full absolute top-0 right-0 border-2 border-[#0A0A12] bg-zinc-800" />
                            <img src={chat.avatar} className="w-8 h-8 rounded-full absolute bottom-0 left-0 border-2 border-[#0A0A12] bg-zinc-700" />
                        </div>
                    ) : (
                        <>
                            <img src={chat.avatar} className="w-full h-full rounded-full bg-white/10" />
                            {chat.online && (
                                <div className="absolute right-0 bottom-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[2.5px] border-[#0A0A12]" />
                            )}
                        </>
                    )}
                </div>

                {/* Center Info */}
                <div className="flex-1 min-w-0 pr-2 pb-0.5 pt-0.5 flex flex-col justify-between h-[44px]">
                    <div className="flex items-center">
                        <h3 
                          onClick={(e) => {
                            if (!chat.isGroup && chat.username) {
                              e.stopPropagation();
                              navigate(`/profile/${chat.username}`);
                            }
                          }}
                          className={`text-[15px] font-bold text-white truncate max-w-[80%] leading-tight ${!chat.isGroup && chat.username ? 'hover:text-[#B026FF] hover:underline cursor-pointer' : ''}`}
                        >
                          {chat.name}
                        </h3>
                        <div className="ml-2 mt-[1px]">
                          {(() => {
                            const flow = getBond(chat.id);
                            if (flow && flow.count > 0) return <BondIcon flow={flow} />;
                            return null;
                          })()}
                        </div>
                        {chat.pinned && <Pin className="w-3 h-3 text-[10px] fill-gray-500 text-gray-500 ml-1.5 shrink-0" />}
                    </div>
                    <div className="flex items-center">
                        <p className={`text-[13px] truncate leading-tight mt-1 ${chat.unread > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                            {chat.lastMessage.includes('You:') ? <span className="text-gray-500 mr-0.5">You:</span> : ''}
                            {chat.lastMessage.replace('You: ', '')}
                        </p>
                    </div>
                </div>

                {/* Right Accents */}
                <div className="flex flex-col items-end justify-between h-[44px] pb-0.5 pt-0.5 pointer-events-none">
                    <span className={`text-[11px] ${chat.unread > 0 ? 'text-[#B026FF] font-bold' : 'text-gray-500'} leading-none`}>{chat.time}</span>
                    <div className="flex items-center mt-auto">
                        {getReadReceiptIcon(chat.lastMessage, chat.unread)}
                        <AnimatePresence>
                            {chat.unread > 0 && (
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full bg-[#B026FF] flex items-center justify-center ml-1 shrink-0"
                                >
                                    <span className="text-white text-[10px] font-bold font-mono">
                                        {chat.unread > 9 ? '9+' : chat.unread}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default function ConnectScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetUserParam = searchParams.get('user');
  
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all'|'requests'>('all');
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const fetchChats = async () => {
      setLoading(true);
      let fetchedChats: any[] = [];
      if (FEATURE_FLAGS.MOCK_MODE) {
        fetchedChats = await getChats();
      }
      
      // Merge with custom chats
      const storedChatsStr = localStorage.getItem('skrimchat_custom_chats');
      const customChats = storedChatsStr ? JSON.parse(storedChatsStr) : {};
      
      const customChatEntries = Object.keys(customChats).map(key => {
         const msgs = customChats[key];
         const lastMsg = msgs[msgs.length - 1];
         const matchedUser = mockUsers.find(u => u.username?.replace('@', '') === key);
         const previewText =
           lastMsg.type === 'spark_share'
             ? (lastMsg.isRepost ? '🔁⚡ Reposted a Spark' : '⚡ Sent you a Spark')
             : (lastMsg.text || lastMsg.caption || 'Sent a message');
         return {
            id: `custom_${key}`,
            name: matchedUser?.displayName || key,
            username: key,
            avatar: matchedUser?.avatar || `https://i.pravatar.cc/150?u=${key}`,
            msg: previewText,
            time: 'Just now',
            unread: 0,
            isVeil: false
         };
      });

      // Filter out duplicates if any
      const finalChats = [...customChatEntries, ...fetchedChats.filter(fc => !customChatEntries.find(cc => cc.name.replace('@', '') === fc.name.replace('@', '')))];
      
      setChats(finalChats);
      setLoading(false);
    }
    fetchChats();
    window.addEventListener('skrimchat_custom_chats_updated', fetchChats);
    return () => window.removeEventListener('skrimchat_custom_chats_updated', fetchChats);
  }, []);

  useEffect(() => {
    const loadRequests = () => {
      setRequests(getMessageRequests());
    };
    loadRequests();
    window.addEventListener('skrimchat_requests_updated', loadRequests);
    return () => window.removeEventListener('skrimchat_requests_updated', loadRequests);
  }, []);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showNewChatPicker, setShowNewChatPicker] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };
  const [customGroups, setCustomGroups] = useState<any[]>([]);

  useEffect(() => {
    const storedGroupsStr = localStorage.getItem('skrimchat_custom_groups');
    if (storedGroupsStr) {
      setCustomGroups(JSON.parse(storedGroupsStr));
    }
  }, []);

  const handleGroupCreated = (groupData: any) => {
    const newGroup = {
       id: `group_${Date.now()}`,
       name: groupData.name,
       avatar: groupData.avatar,
       avatar2: groupData.avatar, // for stacked layout if needed
       isGroup: true,
       lastMessage: `Group created · ${groupData.members.length + 1} members`,
       time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
       unread: 0,
       online: false,
       blazeGrind: 0,
       pinned: false,
       ...groupData
    };
    const updatedGroups = [newGroup, ...customGroups];
    setCustomGroups(updatedGroups);
    localStorage.setItem('skrimchat_custom_groups', JSON.stringify(updatedGroups));
    setShowGroupCreate(false);
    
    // Auto navigation to new group chat could be here
    // navigate(`/chat/${newGroup.id}`);
  };

  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (targetUserParam) {
    // Legacy entry point (?user=username) — redirect to the canonical chat
    // thread screen so messages (including shared Sparks) render correctly
    // through MessageBubble instead of duplicating that logic here.
    useEffect(() => {
      navigate(`/chat/${targetUserParam.replace('@', '')}`, { replace: true });
    }, [targetUserParam]);
    return <div className="w-full h-full bg-[#0A0A12]" />;
  }


  const ACTIVE_USERS = MOCK_CHATS.filter(c => c.online);
  const ACTIVE_MOCKS = [
    ...ACTIVE_USERS, 
    { id: "custom_bappu_bhai", name: "Bappu Bhai", username: "bappu_bhai", avatar: "https://i.pravatar.cc/150?img=1", online: true },
    { id: "custom_sunita_not_astronaut", name: "Sunita W.", username: "sunita_not_astronaut", avatar: "https://i.pravatar.cc/150?img=3", online: true },
    { id: "custom_chikoo_bhai_official", name: "Chikoo", username: "chikoo_bhai_official", avatar: "https://i.pravatar.cc/150?img=6", online: true },
    { id: "custom_bablu_ka_garage", name: "Bablu", username: "bablu_ka_garage", avatar: "https://i.pravatar.cc/150?img=8", online: true },
    { id: "custom_golu_fitness_goals", name: "Golu", username: "golu_fitness_goals", avatar: "https://i.pravatar.cc/150?img=10", online: true }
  ];

  const getActivityForUser = (username?: string, displayName?: string) => {
    const name = (username || displayName || '').toLowerCase();
    if (name.includes('dolly')) return { emoji: '🍲', text: 'COOKING', color: 'from-pink-500/20 to-purple-500/10 border-pink-500/20 text-pink-400' };
    if (name.includes('pappu')) return { emoji: '📚', text: 'CRAMMING', color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/20 text-blue-400' };
    if (name.includes('bappu')) return { emoji: '☕', text: 'CHAI TIME', color: 'from-amber-500/20 to-yellow-600/10 border-amber-500/20 text-amber-400' };
    if (name.includes('sunita')) return { emoji: '🌌', text: 'GAZING', color: 'from-indigo-600/20 to-purple-900/10 border-indigo-500/20 text-indigo-300' };
    if (name.includes('chikoo')) return { emoji: '🏋️', text: 'GYM SELFIE', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20 text-emerald-400' };
    if (name.includes('bablu')) return { emoji: '🔧', text: 'GARAGE', color: 'from-orange-500/20 to-red-500/10 border-orange-500/20 text-orange-400' };
    if (name.includes('golu')) return { emoji: '🥟', text: 'SAMOSAS', color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/20 text-yellow-400' };
    if (name.includes('raju')) return { emoji: '🎮', text: 'IN LOBBY', color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/20 text-cyan-400' };
    if (name.includes('pinky')) return { emoji: '🌸', text: 'SELFIE', color: 'from-rose-400/20 to-pink-500/10 border-rose-400/20 text-rose-400' };
    if (name.includes('munni')) return { emoji: '🎬', text: 'REEL EDIT', color: 'from-fuchsia-500/20 to-purple-600/10 border-fuchsia-500/20 text-fuchsia-400' };
    return { emoji: '⚡', text: 'VIBING', color: 'from-purple-500/20 to-cyan-500/10 border-[#B026FF]/20 text-[#B026FF]' };
  };

  const ALL_CHATS = [...customGroups, ...MOCK_CHATS];
  const totalUnread = ALL_CHATS.reduce((sum, c) => sum + (c.unread || 0), 0);

  const filteredChats = ALL_CHATS.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === 'Unread' && c.unread === 0) return false;
    if (filter === 'Groups' && !c.isGroup) return false;
    return true;
  });

  const atRiskChat = ALL_CHATS.find(c => {
    const flow = getBond(c.id);
    return flow && flow.atRisk;
  });

  return (
    <div className="w-full h-full flex flex-col pt-4 pb-24 relative overflow-hidden bg-[#0A0A12] text-white">
      {/* Top subtle purple gradient */}
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-[#B026FF]/[0.08] to-transparent pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center px-4 mb-4 z-10 relative mt-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-[#B026FF] to-[#00F0FF] bg-clip-text text-transparent">Connect</h1>
          <p className="text-[10px] text-white/30 font-medium">
            {totalUnread > 0 ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'} 💬` : 'All caught up 💬'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreateMenu(true)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Edit className="w-4 h-4 text-white" />
          </button>
          <button onClick={() => navigate('/identity?openSettings=1')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 mb-5 z-10 relative">
        <div className={`flex items-center bg-white/5 rounded-3xl px-4 py-2.5 border transition-all duration-300 ${isSearchFocused ? 'border-[#B026FF] shadow-[0_0_15px_rgba(176,38,255,0.2)]' : 'border-transparent'}`}>
          <Search className={`w-4 h-4 ${isSearchFocused ? 'text-[#B026FF]' : 'text-gray-400'} mr-2`} />
          <input 
            type="text" 
            placeholder="Search conversations..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="bg-transparent flex-1 outline-none text-[15px] placeholder-gray-500 text-white"
          />
        </div>
        
        {/* Filters */}
        <AnimatePresence>
          {isSearchFocused && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="flex gap-2 overflow-x-auto no-scrollbar"
            >
              {['All', 'Unread', 'Groups', 'Archived'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f ? 'bg-[#B026FF]/20 text-[#B026FF] border border-[#B026FF]/30' : 'bg-white/5 text-gray-400 border border-transparent'}`}
                >
                  {f}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex flex-col no-scrollbar pb-20 relative z-10">
          {/* Active Now Row */}
          {!isSearchFocused && (
              <div className="mb-4">
                 <div className="px-4 mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-black text-gray-400 tracking-widest uppercase">LIVE VIBE STORIES</span>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      {ACTIVE_MOCKS.length} ONLINE
                    </span>
                 </div>
                 <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-3 pt-1 w-full snap-x">
                    {/* Your Story Card */}
                    <motion.div
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      className="relative w-[105px] h-[150px] rounded-2xl overflow-hidden shrink-0 cursor-pointer border border-white/5 bg-[#12121A] group/story snap-start"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black/95 z-10" />
                      <img 
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=You" 
                        className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover/story:opacity-40 transition-opacity" 
                        alt="Your avatar"
                      />
                      
                      {/* Top plus badge with pink glow */}
                      <div className="absolute top-3 left-3 z-20">
                        <div className="w-9 h-9 rounded-full border-2 border-[#B026FF] flex items-center justify-center bg-[#B026FF]/20 relative shadow-[0_0_12px_rgba(176,38,255,0.4)]">
                          <span className="text-white text-md font-black leading-none">+</span>
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-0.5">
                        <span className="text-[9px] text-[#B026FF] font-black tracking-wider uppercase font-mono block">CREATE</span>
                        <span className="text-[11px] text-white/90 font-extrabold drop-shadow truncate">Your Story</span>
                      </div>
                    </motion.div>

                    {/* Active Contacts Cards */}
                    {ACTIVE_MOCKS.map(contact => {
                      const activity = getActivityForUser(contact.username, contact.name);
                      return (
                        <motion.div 
                          key={contact.id} 
                          whileHover={{ scale: 1.04, y: -2 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => navigate(`/chat/${contact.id}`)}
                          className="relative w-[105px] h-[150px] rounded-2xl overflow-hidden shrink-0 cursor-pointer border border-white/10 bg-[#161622] shadow-[0_8px_24px_rgba(0,0,0,0.4)] group/story snap-start transition-all"
                        >
                          {/* Card background glowing gradient or blurred wallpaper */}
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10" />
                          <div 
                            className="absolute inset-0 opacity-30 group-hover/story:opacity-50 transition-all duration-300 scale-105 group-hover/story:scale-110 blur-[1px] bg-cover bg-center"
                            style={{ backgroundImage: `url(${contact.avatar})` }}
                          />
                          
                          {/* Top Avatar with pulsing emerald border */}
                          <div className="absolute top-3 left-3 z-20">
                            <div 
                              className="relative w-9 h-9 cursor-pointer hover:scale-105 transition-transform"
                              onClick={(e) => {
                                if (contact.username) {
                                  e.stopPropagation();
                                  navigate(`/profile/${contact.username}`);
                                }
                              }}
                              title="View Profile"
                            >
                              <div className="absolute inset-[-2px] rounded-full border-2 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" style={{ animationDuration: '2.5s' }} />
                              <img src={contact.avatar} className="w-full h-full rounded-full border border-black/50 object-cover relative z-10 bg-zinc-800" alt={contact.name} />
                              <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#161622] z-20" />
                            </div>
                          </div>

                          {/* Activity Badge inside the card */}
                          <div className="absolute top-3 right-3 z-20">
                            <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-xs shadow-md">
                              {activity.emoji}
                            </div>
                          </div>

                          {/* Bottom Info */}
                          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-0.5">
                            <span className="text-[9px] text-emerald-400 font-black tracking-wider uppercase font-mono block">
                              {activity.text}
                            </span>
                            <span className="text-[12px] text-white font-extrabold truncate drop-shadow-md">
                              {contact.name.split(' ')[0]}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                 </div>
              </div>
          )}

          {/* Messages Header */}
          <div className="px-4 mt-6 mb-2">
              <span className="text-[11px] font-bold text-gray-500 tracking-widest uppercase">Messages</span>
          </div>

          {/* Chat List */}
          {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8 opacity-60">
                 <MessageCircle className="w-12 h-12 text-gray-500 mb-4" />
                 <p className="text-white font-medium mb-1">No conversations found</p>
                 <p className="text-sm text-gray-500">Start connecting with people you follow!</p>
              </div>
          ) : (
              <div className="flex flex-col">
                  {atRiskChat && (
                     <div className="px-4 mb-2">
                       <div onClick={() => navigate(`/chat/${atRiskChat.id}`)} className="bg-gradient-to-r from-orange-500/20 to-red-500/10 border border-orange-500/30 rounded-2xl p-3 flex items-center justify-between cursor-pointer shadow-[0_0_15px_rgba(255,165,0,0.1)]">
                          <div>
                             <div className="flex items-center gap-2 mb-0.5 text-orange-400">
                               <BondIcon flow={getBond(atRiskChat.id)!} />
                               <span className="text-white font-bold text-sm ml-1">{atRiskChat.name}</span>
                               <span className="text-yellow-500 font-bold ml-1">⚠️</span>
                             </div>
                             <p className="text-orange-200/80 text-xs">"Message now or lose your flow! ⏰"</p>
                          </div>
                          <div className="px-3 py-1.5 bg-orange-500 text-white font-bold text-xs rounded-full">Message</div>
                       </div>
                     </div>
                  )}
                  {filteredChats.map(chat => (
                     <SwipeableChatRow key={chat.id} chat={chat} onClick={() => navigate(`/chat/${chat.id}`)} />
                  ))}
              </div>
          )}
      </div>

      {/* FAB - Compose */}
      <button 
        onClick={() => setShowCreateMenu(true)}
        className="absolute bottom-24 right-5 sm:bottom-6 sm:right-6 bg-gradient-to-tr from-[#B026FF] to-[#D869FF] text-white rounded-full px-5 py-3.5 shadow-[0_4px_25px_rgba(176,38,255,0.4)] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all z-40"
      >
          <Edit className="w-5 h-5" />
          <span className="font-bold text-sm">New Chat</span>
      </button>

      <AnimatePresence>
        {showCreateMenu && (
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0" 
              onClick={() => setShowCreateMenu(false)}
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 bg-[#1A1A24] rounded-t-3xl p-4 pb-8 shadow-2xl border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
              <div className="space-y-3">
                 <button 
                   onClick={() => { setShowCreateMenu(false); setShowNewChatPicker(true); }}
                   className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                 >
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                       <MessageCircle />
                    </div>
                    <div className="text-left flex-1">
                       <div className="text-white font-bold text-lg">New Chat</div>
                       <div className="text-white/50 text-sm">Start a simple 1-on-1 chat</div>
                    </div>
                 </button>
                 <button 
                   onClick={() => { setShowCreateMenu(false); setShowGroupCreate(true); }}
                   className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30 hover:border-neon-purple/60 transition-colors"
                 >
                    <div className="w-12 h-12 rounded-full bg-neon-purple text-white flex items-center justify-center shadow-[0_0_15px_rgba(176,38,255,0.5)]">
                       <Users />
                    </div>
                    <div className="text-left flex-1">
                       <div className="text-white font-bold text-lg">New Group</div>
                       <div className="text-white/70 text-sm">Create a squad, invite friends</div>
                    </div>
                 </button>
                 <button 
                   onClick={() => { setShowCreateMenu(false); showToast('📢 Broadcast lists coming soon!'); }}
                   className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                 >
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
                       <Megaphone />
                    </div>
                    <div className="text-left flex-1">
                       <div className="text-white font-bold text-lg">New Broadcast</div>
                       <div className="text-white/50 text-sm">Send message to multiple people</div>
                    </div>
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupCreate && (
          <GroupCreateFlow 
            onClose={() => setShowGroupCreate(false)}
            onGroupCreated={handleGroupCreated}
          />
        )}
      </AnimatePresence>

      {/* New Chat — pick a person to start a 1-on-1 chat with */}
      <AnimatePresence>
        {showNewChatPicker && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-skrim-bg">
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <button onClick={() => setShowNewChatPicker(false)} className="text-white/70 hover:text-white">
                <ArrowLeft />
              </button>
              <h2 className="text-white font-bold text-lg">New Chat</h2>
              <button
                onClick={() => { setShowNewChatPicker(false); setShowGroupCreate(true); }}
                className="text-[#B026FF] text-sm font-bold flex items-center gap-1"
              >
                <Users className="w-4 h-4" /> Group
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {MOCK_CHATS.filter(c => !c.isGroup).map(person => (
                <button
                  key={person.id}
                  onClick={() => { setShowNewChatPicker(false); navigate(`/chat/${person.id}`); }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left"
                >
                  <div 
                    className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      if (person.username) {
                        e.stopPropagation();
                        setShowNewChatPicker(false);
                        navigate(`/profile/${person.username}`);
                      }
                    }}
                    title="View Profile"
                  >
                    <img src={person.avatar} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                    {person.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-skrim-bg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div 
                      onClick={(e) => {
                        if (person.username) {
                          e.stopPropagation();
                          setShowNewChatPicker(false);
                          navigate(`/profile/${person.username}`);
                        }
                      }}
                      className="text-white font-semibold text-sm truncate hover:text-[#B026FF] hover:underline cursor-pointer"
                    >
                      {person.name}
                    </div>
                    <div className="text-white/40 text-xs truncate">{person.online ? 'Online' : 'Offline'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightweight toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[10050] bg-[#1A1A24] border border-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
