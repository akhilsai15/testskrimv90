import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import {
  Zap, MessageCircle, Share2, Bookmark, Volume2, VolumeX,
  Music, Heart, Play, Pause, ChevronUp, ChevronDown, Search, X,
  MoreHorizontal, Plus, Images, Video, RefreshCw, Send, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { assembleVibesFeed, getDefaultMood, MOODS, MOCK_USERS, type VibePost } from '../lib/mock/skrimAlgorithm';
import { incrementStat } from '../lib/mock/achievementEngine';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { MusicPicker } from '../components/MusicPicker';
import { useSavedStore } from '../store/savedStore';
import { ReactionRow } from '../components/ReactionRow';
import { useNavigate } from 'react-router-dom';
import { useFollowStatus, followUser, unfollowUser } from '../lib/mock/mockSocialGraph';
import { SKRIM_REACTIONS } from '../lib/mock/mockData';
import { triggerReactionAnimation } from '../lib/animations/reactionAnimations';

// ─── helpers ─────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ─── Floating emoji burst on double-tap ──────────────────────
function HeartBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  return (
    <motion.div
      className="pointer-events-none fixed z-[200] text-5xl select-none"
      style={{ left: x - 30, top: y - 30 }}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: [0, 1.6, 1.2], opacity: [1, 1, 0], y: -80 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      ⚡
    </motion.div>
  );
}

// ─── Action Button ────────────────────────────────────────────
function ActionBtn({
  icon, label, active, color = '#fff', onClick,
}: { icon: React.ReactNode; label: string; active?: boolean; color?: string; onClick?: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 select-none"
    >
      <motion.div
        animate={active ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10"
        style={{ boxShadow: active ? `0 0 14px ${color}88` : undefined }}
      >
        {icon}
      </motion.div>
      <span className="text-[11px] font-bold text-white/90 drop-shadow">{label}</span>
    </motion.button>
  );
}

// ─── Progress bar row ─────────────────────────────────────────
function ProgressBars({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1 px-4">
      {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
        <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/20">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={{ width: i < current ? '100%' : '0%' }}
            animate={{
              width: i < current ? '100%' : i === current ? '100%' : '0%',
            }}
            transition={i === current ? { duration: 15, ease: 'linear' } : { duration: 0 }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Caption with expand ──────────────────────────────────────
function Caption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 80;
  const shown = expanded || !isLong ? text : text.slice(0, 80) + '…';
  return (
    <p className="text-white/90 text-sm leading-relaxed drop-shadow">
      {shown.split(' ').map((w, i) =>
        w.startsWith('#')
          ? <span key={i} className="text-[#00F0FF] font-semibold">{w} </span>
          : w + ' '
      )}
      {isLong && !expanded && (
        <button onClick={() => setExpanded(true)} className="text-white/50 font-bold ml-1">more</button>
      )}
    </p>
  );
}

// ─── Single Vibe Card ─────────────────────────────────────────
function VibeCard({
  vibe,
  isActive,
  muted,
  onToggleMute,
  onNext,
  onPrev,
  total,
  current,
}: {
  vibe: VibePost;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onNext: () => void;
  onPrev: () => void;
  total: number;
  current: number;
}) {
  const { savePost, unsavePost, savedPosts } = useSavedStore();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const followStatus = useFollowStatus(vibe.handle);

  const [liked, setLiked]   = useState(() => {
    try {
      if (!vibe?.id) return false;
      const l: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_liked') || '[]');
      return Array.isArray(l) && l.includes(vibe.id);
    } catch { return false; }
  });
  
  const saved = savedPosts.includes(vibe?.id);

  const [pulses, setPulses] = useState(() => {
    try {
      if (!vibe?.id) return 0;
      const counts: Record<string,number> = JSON.parse(localStorage.getItem('skrimchat_vibe_counts') || '{}');
      return counts[vibe.id] ?? vibe.pulseCount ?? 0;
    } catch { return vibe?.pulseCount ?? 0; }
  });
  const [commentCount, setCommentCount] = useState(() => vibe?.comments ?? 0);
  const [burst, setBurst]   = useState<{ x: number; y: number } | null>(null);
  const [showComments, setShowComments] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [commentsList, setCommentsList] = useState<any[]>([]);

  // Interactive timeline seeker state
  const [progress, setProgress] = useState(0); // 0 to 100
  const [duration, setDuration] = useState(15); // default duration
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    try {
      if (!vibe?.id) return;
      const stored = localStorage.getItem(`skrimchat_vibe_comments_list_${vibe.id}`);
      if (stored) {
        setCommentsList(JSON.parse(stored));
      } else {
        const initial = [
          { id: '1', user: '@bappu_bhai', text: 'bhai ekdum fire hai 🔥', time: '1h ago', likes: 47 },
          { id: '2', user: '@sunita_not', text: 'yaar yeh too good 😭', time: '2h ago', likes: 92 },
          { id: '3', user: '@raju_3idiots_fan', text: 'iske jaisi content koi nahi banata seriously 💜', time: '3h ago', likes: 140 },
          { id: '4', user: '@dolly_ka_dhaba', text: 'screenshot liya 📸 pure gold', time: '4h ago', likes: 21 },
        ];
        setCommentsList(initial);
        localStorage.setItem(`skrimchat_vibe_comments_list_${vibe.id}`, JSON.stringify(initial));
      }
    } catch (e) {
      setCommentsList([]);
    }
  }, [vibe?.id]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const added = {
      id: Date.now().toString(),
      user: currentUser?.username || '@you',
      text: newComment,
      time: 'Just now',
      likes: 0,
    };
    const updated = [added, ...commentsList];
    setCommentsList(updated);
    setNewComment('');
    setCommentCount(c => c + 1);
    try {
      localStorage.setItem(`skrimchat_vibe_comments_list_${vibe.id}`, JSON.stringify(updated));
      const cc: Record<string,number> = JSON.parse(localStorage.getItem('skrimchat_vibe_comments') || '{}');
      cc[vibe.id] = (cc[vibe.id] || vibe.comments) + 1;
      localStorage.setItem('skrimchat_vibe_comments', JSON.stringify(cc));
    } catch (e) {}
  };

  const [activeReactionId, setActiveReactionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`skrimchat_vibe_reaction_${vibe?.id}`) || null;
    } catch (e) {
      return null;
    }
  });
  
  const [reactions, setReactions] = useState<Record<string, number>>(() => {
    try {
      if (!vibe?.id) return vibe?.reactions || {};
      const stored = localStorage.getItem(`skrimchat_vibe_reactions_count_${vibe.id}`);
      return stored ? JSON.parse(stored) : (vibe.reactions || {});
    } catch {
      return vibe?.reactions || {};
    }
  });

  const handleReact = (rId: string | null, reactionObj?: any) => {
    const oldId = activeReactionId;
    setActiveReactionId(rId);
    
    setReactions(prev => {
      const next = { ...prev };
      if (oldId) {
        next[oldId] = Math.max(0, (next[oldId] || 0) - 1);
      }
      if (rId) {
        next[rId] = (next[rId] || 0) + 1;
        if (reactionObj) {
          // Trigger floating visual effect and toast
          setBurst({ x: window.innerWidth / 2, y: window.innerHeight / 2.5 });
          setToastMessage(`Reacted with ${reactionObj.emoji} ${reactionObj.name}! ⚡`);
          setTimeout(() => setToastMessage(''), 1800);
        }
      }
      try {
        localStorage.setItem(`skrimchat_vibe_reactions_count_${vibe.id}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      if (rId) {
        localStorage.setItem(`skrimchat_vibe_reaction_${vibe.id}`, rId);
        incrementStat('reactionsSent', 1);
        const reaction = SKRIM_REACTIONS.find(r => r.id === rId);
        const el = document.getElementById(`vibe-container-${vibe.id}`);
        if (el && reaction) {
          triggerReactionAnimation(el, reaction.id, reaction.emoji);
        }
      } else {
        localStorage.removeItem(`skrimchat_vibe_reaction_${vibe.id}`);
      }
    } catch (e) {}
  };

  const [toastMessage, setToastMessage] = useState('');

  const handleShare = () => {
    incrementStat('shares', 1);
    const shareUrl = `${window.location.origin}/vibes?id=${vibe.id}`;
    try {
      navigator.clipboard.writeText(shareUrl);
      setToastMessage('Link copied to clipboard! 🚀');
    } catch (err) {
      setToastMessage('Shared vibe with friends! 💜');
    }
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };
  const lastTap = useRef(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState<'play' | 'pause' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tapTimeout = useRef<any>(null);
  const overlayTimeout = useRef<any>(null);

  // Sync play/pause with active state
  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    } else {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isActive]);

  // Sync with local isPlaying state
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying && isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, isActive]);

  useEffect(() => {
    return () => {
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    };
  }, []);

  const dragY = useMotionValue(0);
  const imgScale = useTransform(dragY, [-200, 0, 200], [1.05, 1, 1.05]);

  if (!vibe) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white/50 text-xs">
        No Vibe Content Available
      </div>
    );
  }

  const handleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double tap
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
      }
      if (!liked) {
        setLiked(true);
        setPulses(p => {
          const next = p + 1;
          try {
            const l: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_liked') || '[]');
            if (!l.includes(vibe.id)) localStorage.setItem('skrimchat_vibe_liked', JSON.stringify([...l, vibe.id]));
            const c: Record<string,number> = JSON.parse(localStorage.getItem('skrimchat_vibe_counts') || '{}');
            c[vibe.id] = next;
            localStorage.setItem('skrimchat_vibe_counts', JSON.stringify(c));
          } catch (e) {}
          return next;
        });
        incrementStat('reactionsSent', 1);
        incrementStat('pulseScore', 3);
      }
      setBurst({ x: e.clientX, y: e.clientY });
    } else {
      // single tap (Play/Pause)
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      tapTimeout.current = setTimeout(() => {
        setIsPlaying(prev => {
          const next = !prev;
          setShowPlayOverlay(next ? 'play' : 'pause');
          if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
          overlayTimeout.current = setTimeout(() => {
            setShowPlayOverlay(null);
          }, 600);
          return next;
        });
        tapTimeout.current = null;
      }, 250);
    }
    lastTap.current = now;
  };

  // Loop effect to simulate playback progress for image-only Vibes
  useEffect(() => {
    if (vibe.videoSrc) return; // Handled by video element's real timeupdate events
    if (!isPlaying || !isActive) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 0.1;
        if (next >= duration) {
          setProgress(0);
          return 0; // loop
        }
        setProgress((next / duration) * 100);
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, isActive, duration, vibe.videoSrc]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || 15;
      setCurrentTime(cur);
      setDuration(dur);
      setProgress((cur / dur) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 15);
    }
  };

  // Seeker timeline interaction callback
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newPercent = Math.min(Math.max((clickX / width) * 100, 0), 100);
    setProgress(newPercent);
    const newTime = (newPercent / 100) * duration;
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setToastMessage(`Skipped to ${newTime.toFixed(1)}s! ⚡`);
    setTimeout(() => setToastMessage(''), 1500);
  };

  // Profile redirection handler
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanVibeUser = vibe.handle.replace(/^@/, '');
    const cleanCurrentUser = currentUser?.username?.replace(/^@/, '');
    
    if (cleanVibeUser === cleanCurrentUser) {
      navigate('/identity');
    } else {
      navigate(`/profile/${cleanVibeUser}`);
    }
  };

  // Social graph follow toggle callback
  const handleFollowToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (followStatus.following) {
      unfollowUser(vibe.handle);
      setToastMessage(`Unfollowed ${vibe.user} 💔`);
    } else {
      followUser(vibe.handle);
      setToastMessage(`Following ${vibe.user}! 💜`);
      incrementStat('connectionsMade', 1);
    }
    setTimeout(() => setToastMessage(''), 2000);
  };

  const isMe = vibe.handle.replace(/^@/, '') === currentUser?.username?.replace(/^@/, '');

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.y < -60) onNext();
    if (info.offset.y >  60) onPrev();
    dragY.set(0);
  };

  const handleTapMedia = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) {
        setLiked(true);
        setPulses(p => {
          const next = p + 1;
          try {
            const l: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_liked') || '[]');
            if (!l.includes(vibe.id)) localStorage.setItem('skrimchat_vibe_liked', JSON.stringify([...l, vibe.id]));
            const c: Record<string,number> = JSON.parse(localStorage.getItem('skrimchat_vibe_counts') || '{}');
            c[vibe.id] = next;
            localStorage.setItem('skrimchat_vibe_counts', JSON.stringify(c));
          } catch (e) {}
          return next;
        });
        incrementStat('reactionsSent', 1);
        incrementStat('pulseScore', 3);
      }
      setBurst({ x: e.clientX, y: e.clientY });
    } else {
      setIsPlaying(p => !p);
    }
    lastTap.current = now;
  };

  return (
    <div className="w-full h-full bg-[#08080C] pt-24 pb-4 px-4 md:px-6 flex flex-col md:grid md:grid-cols-12 md:gap-6 text-white overflow-y-auto md:overflow-hidden select-none">
      {/* LEFT COLUMN: Holographic Media Deck */}
      <div className="md:col-span-7 lg:col-span-8 flex flex-col h-full justify-between gap-4 overflow-hidden min-h-[350px] md:min-h-0">
        
        {/* Holographic Media Frame */}
        <div 
          id={`vibe-container-${vibe.id}`}
          onClick={handleTapMedia}
          className="relative flex-1 w-full bg-black/60 rounded-3xl border border-[#B026FF]/20 shadow-2xl shadow-[#B026FF]/10 overflow-hidden group cursor-pointer"
        >
          {vibe.videoSrc ? (
            <motion.video
              ref={videoRef}
              src={vibe.videoSrc}
              autoPlay={isActive}
              loop
              muted={muted}
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            />
          ) : (
            <motion.img
              src={vibe.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              draggable={false}
            />
          )}

          {/* Futuristic subtle grid overlay & scanline */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none opacity-20" />
          
          {/* Edge glowing accents */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00F0FF]/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#B026FF]/40 to-transparent" />

          {/* Toast Notification Container inside Frame */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -20, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: -20, x: "-50%" }}
                className="absolute top-6 left-1/2 z-30 bg-black/90 backdrop-blur-md px-4 py-2 flex items-center gap-2 rounded-full border border-white/20 select-none pointer-events-none"
              >
                <span className="text-white text-xs font-bold tracking-wider">{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tap Play/Pause overlay */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center z-20 pointer-events-none shadow-lg shadow-black/40"
              >
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Double-tap burst */}
          {burst && (
            <HeartBurst x={burst.x} y={burst.y} onDone={() => setBurst(null)} />
          )}
        </div>

        {/* Console Deck Control Bar (Playbar) */}
        <div className="flex items-center justify-between bg-[#0F0F15] border border-white/5 rounded-2xl p-3 px-4 w-full select-none gap-3">
          
          {/* Left Controls: Play / Pause */}
          <button 
            onClick={() => setIsPlaying(p => !p)} 
            className="p-2.5 rounded-xl bg-white/5 hover:bg-[#B026FF]/20 text-white transition-colors active:scale-90"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-[#00F0FF]" /> : <Play className="w-4 h-4 text-[#B026FF] fill-[#B026FF]" />}
          </button>

          {/* Center Seeker Line */}
          <div 
            onClick={handleSeek}
            className="flex-1 h-2 bg-white/10 rounded-full relative cursor-pointer group/seeker"
            title="Click to Seek Vibe Progress"
          >
            {/* Click hit box padding */}
            <div className="absolute inset-y-[-6px] inset-x-0 cursor-pointer" />
            
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF] rounded-full transition-all duration-100 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Seeker knob on hover */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] opacity-0 group-hover/seeker:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Audio Sound Toggle */}
          <button 
            onClick={onToggleMute} 
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors active:scale-90"
          >
            {muted ? <VolumeX className="w-4 h-4 text-gray-500" /> : <Volume2 className="w-4 h-4 text-[#00F0FF]" />}
          </button>

          {/* Right Controls: Deck Navigation (Prev / Next) */}
          <div className="flex gap-1.5 border-l border-white/10 pl-3">
            <button 
              onClick={onPrev} 
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-colors active:scale-90"
              title="Previous Vibe Deck"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={onNext} 
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-colors active:scale-90"
              title="Next Vibe Deck"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Vibe Telemetry & Interaction Console */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col h-full gap-4 overflow-hidden min-h-[450px] md:min-h-0">
        
        {/* Main Interface Console Board */}
        <div className="flex-1 bg-[#0D0D14]/90 backdrop-blur-lg border border-white/10 rounded-3xl p-4 flex flex-col gap-4 overflow-hidden shadow-2xl shadow-[#B026FF]/5">
          
          {/* Creator Profile Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-3">
              <img 
                src={vibe.avatar} 
                alt={vibe.user} 
                onClick={handleProfileClick}
                className="w-10 h-10 rounded-full border border-[#B026FF]/60 object-cover shadow-inner cursor-pointer hover:border-[#00F0FF] transition-colors" 
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span 
                    onClick={handleProfileClick}
                    className="font-bold text-sm text-white hover:text-[#B026FF] cursor-pointer transition-colors"
                  >
                    {vibe.user}
                  </span>
                  <span className="text-[9px] text-[#B026FF] font-extrabold border border-[#B026FF]/40 px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#B026FF]/10 select-none">
                    {vibe.creatorTier}
                  </span>
                </div>
                <span 
                  onClick={handleProfileClick}
                  className="text-xs text-white/40 block leading-tight hover:text-white cursor-pointer transition-colors"
                >
                  {vibe.handle}
                </span>
              </div>
            </div>
            {!isMe && (
              <button 
                onClick={handleFollowToggle}
                className={`text-[10px] font-black px-3 py-1.5 rounded-xl tracking-widest transition-all active:scale-95 border ${
                  followStatus.following 
                    ? 'text-white/40 bg-white/5 border-white/10 hover:bg-white/10' 
                    : 'text-[#00F0FF] bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border-[#00F0FF]/30'
                }`}
              >
                {followStatus.following ? 'FOLLOWING' : 'FOLLOW'}
              </button>
            )}
          </div>

          {/* Vibe Meter / Telemetry Gauge */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-white/50 tracking-wider">
              <span>VIBE TELEMETRY_</span>
              <span className="font-bold text-[#FF2D87]">
                {vibe.vibeScore > 75 ? '🚀 NOVA' : '🔥 ACTIVE'}
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF]"
                style={{ width: `${vibe.vibeScore}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/40 font-mono tracking-tight">
              <span>SCORE: {vibe.vibeScore.toFixed(0)} pts</span>
              <span>SYSTEM ONLINE</span>
            </div>
          </div>

          {/* Caption */}
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-xs max-h-[72px] overflow-y-auto custom-scrollbar">
            <Caption text={vibe.caption} />
          </div>

          {/* Social Action Grid */}
          <div className="grid grid-cols-4 gap-2">
            
            {/* Pulse Action */}
            <button 
              onClick={() => {
                setLiked(l => {
                  const next = !l;
                  setPulses(p => {
                    const newP = next ? p + 1 : p - 1;
                    try {
                      const arr: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_liked') || '[]');
                      const updated = next ? [...arr.filter(x => x !== vibe.id), vibe.id] : arr.filter(x => x !== vibe.id);
                      localStorage.setItem('skrimchat_vibe_liked', JSON.stringify(updated));
                      const c: Record<string,number> = JSON.parse(localStorage.getItem('skrimchat_vibe_counts') || '{}');
                      c[vibe.id] = newP;
                      localStorage.setItem('skrimchat_vibe_counts', JSON.stringify(c));
                    } catch (e) {}
                    return newP;
                  });
                  return next;
                });
                incrementStat('reactionsSent', 1);
                incrementStat('pulseScore', 3);
              }}
              className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 ${
                liked 
                  ? 'bg-[#B026FF]/15 border-[#B026FF] text-[#B026FF] shadow-lg shadow-[#B026FF]/10' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title="Pulse (Like)"
            >
              <Zap className={`w-4 h-4 ${liked ? 'fill-[#B026FF]' : ''}`} />
              <span className="text-[10px] font-bold font-mono">{fmt(pulses)}</span>
            </button>

            {/* Save Action */}
            <button 
              onClick={() => {
                if (saved) {
                  unsavePost(vibe.id);
                } else {
                  savePost(vibe.id, vibe);
                }
              }}
              className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 ${
                saved 
                  ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-[#00F0FF] shadow-lg shadow-[#00F0FF]/10' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title="Save to Identity"
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-[#00F0FF]' : ''}`} />
              <span className="text-[10px] font-bold font-mono">{fmt(vibe.saves)}</span>
            </button>

            {/* Share Action */}
            <button 
              onClick={handleShare}
              className="p-2.5 rounded-2xl bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
              title="Share Link"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-[10px] font-bold font-mono">{fmt(vibe.shares)}</span>
            </button>

            {/* Audio Widget */}
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5 text-white/60 flex flex-col items-center justify-center gap-1 overflow-hidden">
              <Music className="w-4 h-4 text-[#B026FF] animate-pulse" />
              <span className="text-[8px] font-bold text-center truncate w-full tracking-tighter" title={vibe.audio}>
                {vibe.audio?.split('·')[0] || 'Audio'}
              </span>
            </div>

          </div>

          {/* Reaction Sparks Container */}
          <div className="bg-white/5 p-2 rounded-2xl border border-white/5 flex items-center justify-center">
            <ReactionRow
              initialReactions={reactions}
              activeReactionId={activeReactionId}
              onReact={handleReact}
              className="scale-95 origin-center w-full justify-around"
            />
          </div>

          {/* Direct Comments Console Feed */}
          <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-white/5 p-3 overflow-hidden">
            <div className="text-[9px] font-mono text-white/40 mb-2 tracking-wider flex items-center justify-between border-b border-white/5 pb-1 select-none">
              <span>SECURE_COMMENTS_STREAM</span>
              <span>{fmt(commentCount)} NODES</span>
            </div>
            
            {/* Scrollable comments list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[160px] md:max-h-none">
              {commentsList.map((c, i) => (
                <div key={c.id || i} className="flex gap-2 text-xs">
                  <img src={`https://i.pravatar.cc/150?img=${(i + 20) % 70}`} className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10" alt="" />
                  <div className="flex-1 bg-white/5 p-2 rounded-xl border border-white/5">
                    <div className="flex justify-between text-[9px] text-white/30 mb-0.5 font-mono">
                      <span className="font-bold text-[#B026FF]">{c.user}</span>
                      <span>{c.time}</span>
                    </div>
                    <p className="text-white/80 leading-normal text-[11px]">{c.text}</p>
                  </div>
                </div>
              ))}
              {commentsList.length === 0 && (
                <div className="text-center py-8 text-white/30 text-xs">No entries. Broadcast a comment node below!</div>
              )}
            </div>

            {/* Direct Comment Input Bar */}
            <form onSubmit={(e) => { e.preventDefault(); handleAddComment(); }} className="flex gap-1.5 mt-2 pt-2 border-t border-white/5">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Inject comment..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#B026FF] placeholder-white/20 font-sans"
              />
              <button
                type="submit"
                className="px-3 rounded-xl bg-[#B026FF] hover:bg-[#B026FF]/80 text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}

// ─── Vibe Create Sheet ─────────────────────────────────────────
// Same shape as Pulse's composer (photo/video + caption + mood + music),
// but tailored to Vibes: exactly one media item (a Vibe IS the clip, not
// an optional attachment), and posting drops it straight into the feed
// instead of going through any approval/processing step (this is a mock).
function VibeCreateSheet({ isOpen, onClose, currentUser, onPost }: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onPost: (vibe: VibePost) => void;
}) {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null);
  const [mood, setMood] = useState<string>(getDefaultMood());
  const [music, setMusic] = useState<{ url: string; title: string; start_ms: number } | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCaption('');
    setMediaUrl(null);
    setMediaKind(null);
    setMood(getDefaultMood());
    setMusic(null);
    setIsReading(false);
    setShowMoodPicker(false);
    setShowMusicPicker(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
    if (!kind) return;
    setIsReading(true);
    const r = new FileReader();
    r.onload = () => {
      setMediaUrl(r.result as string);
      setMediaKind(kind);
      setIsReading(false);
    };
    r.readAsDataURL(file);
  };

  const canPost = !!mediaUrl;

  const handlePost = () => {
    if (!canPost) return;
    const id = `vibe_user_${Date.now()}`;
    const newVibe: VibePost = {
      id,
      user: currentUser?.username || 'You',
      handle: `@${currentUser?.handle || 'you'}`,
      avatar: currentUser?.avatar || '',
      thumbnail: mediaKind === 'image' ? mediaUrl! : '',
      caption,
      audio: music?.title || 'Original Audio 🎤',
      mood,
      createdAt: Date.now(),
      pulseCount: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reactions: { pulse: 0, blaze: 0, vibe: 0, dead: 0 },
      creatorCountry: 'India',
      creatorTier: 'RISING',
      vibeScore: 100,
      watchTimeScore: 0,
      rewatchRatio: 0,
      ...(mediaKind === 'video' ? { videoSrc: mediaUrl } : {}),
    } as VibePost;

    // Persist alongside mock data so a refresh doesn't lose it, following
    // the same skrimchat_* localStorage convention used across the app.
    try {
      const existing = JSON.parse(localStorage.getItem('skrimchat_user_vibes') || '[]');
      localStorage.setItem('skrimchat_user_vibes', JSON.stringify([newVibe, ...existing]));
    } catch (e) {}

    onPost(newVibe);
    reset();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[80] backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[90] bg-[#0d0010] rounded-t-3xl border-t border-white/10 max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
              <button onClick={handleClose} className="text-white/50 text-sm">Cancel</button>
              <span className="text-white font-bold text-base">New Vibe</span>
              <button
                onClick={handlePost}
                disabled={!canPost}
                className={`text-sm font-bold px-4 py-1.5 rounded-full transition-all ${canPost ? 'bg-[#B026FF] text-white' : 'bg-white/10 text-white/30'}`}
              >
                Post
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {/* Media — Vibes are video-first, so this is the main event,
                  not an optional attachment like in the Pulse composer. */}
              {mediaUrl ? (
                <div className="relative w-full aspect-[9/16] max-h-[42vh] mx-auto rounded-2xl overflow-hidden bg-black">
                  {mediaKind === 'video' ? (
                    <video src={mediaUrl} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => { setMediaUrl(null); setMediaKind(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : isReading ? (
                <div className="flex items-center gap-2 text-white/40 text-xs py-10 justify-center">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Adding media…
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 py-8 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/5 transition-colors"
                  >
                    <Video className="w-7 h-7 text-[#00F0FF]" />
                    <span className="text-xs font-semibold text-white/70">Upload a video</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 py-8 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#B026FF]/50 hover:bg-[#B026FF]/5 transition-colors"
                  >
                    <Images className="w-7 h-7 text-[#B026FF]" />
                    <span className="text-xs font-semibold text-white/70">Upload a photo</span>
                  </button>
                </div>
              )}

              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write a caption…"
                rows={2}
                className="w-full bg-transparent text-white text-[15px] leading-relaxed placeholder-white/25 resize-none outline-none"
              />
            </div>

            {/* Mood + Music — same controls as Pulse, so a creator's vocabulary
                for "what kind of post is this" stays consistent app-wide. */}
            <div className="flex items-center gap-1 px-4 py-3 border-t border-white/8">
              <button
                onClick={() => setShowMoodPicker(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors text-xs font-semibold"
              >
                <span className="text-base leading-none">{MOODS.find(m => m.id === mood)?.emoji}</span> Mood
              </button>
              <button
                onClick={() => setShowMusicPicker(true)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-colors text-xs font-semibold ${music ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
              >
                <Music className="w-5 h-5" /> {music ? music.title : 'Music'}
              </button>
            </div>
          </motion.div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <AnimatePresence>
            {showMoodPicker && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 z-[95]"
                  onClick={() => setShowMoodPicker(false)}
                />
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 z-[96] bg-[#0d0010] rounded-t-3xl border-t border-white/10 px-5 pb-8 pt-3"
                >
                  <div className="flex justify-center pb-3"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
                  <h3 className="text-white font-bold text-base mb-4">Pick a mood</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {MOODS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMood(m.id); setShowMoodPicker(false); }}
                        className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-colors ${mood === m.id ? 'border-[#B026FF] bg-[#B026FF]/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-xs font-semibold text-white/80">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <MusicPicker
            isOpen={showMusicPicker}
            onClose={() => setShowMusicPicker(false)}
            onSelect={(m) => { setMusic(m); setShowMusicPicker(false); }}
            currentMusic={music}
            context="Vibe"
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main Vibes Screen ────────────────────────────────────────
export default function VibesScreen() {
  const currentUser = useCurrentUser();
  const [vibes, setVibes]           = useState<VibePost[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [muted, setMuted]           = useState(true);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState('foryou');
  const [mood] = useState(() => localStorage.getItem('skrimchat_mood') || getDefaultMood());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter → seed offset so each tab produces different content
  const filterSeedOffset: Record<string, number> = {
    foryou: 0, following: 500, trending: 1000, new: 1500, nearby: 2000, myvibes: 3000,
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Session-only user vibes uploaded in the current session so that they get immediate
  // visual feedback in the For You feed without permanently dominating index 0 on future reloads.
  const [sessionUserVibes, setSessionUserVibes] = useState<VibePost[]>([]);

  // Persistent user-uploaded vibes
  const [userVibes, setUserVibes] = useState<VibePost[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('skrimchat_user_vibes') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  // Randomized offset on mount so returning always shows new/different vibes
  const [refreshOffsets, setRefreshOffsets] = useState<Record<string, number>>(() => {
    return {
      foryou: Math.floor(Math.random() * 50) * 10,
      following: Math.floor(Math.random() * 50) * 10,
      trending: Math.floor(Math.random() * 50) * 10,
      new: Math.floor(Math.random() * 50) * 10,
      nearby: Math.floor(Math.random() * 50) * 10,
    };
  });

  const handlePosted = useCallback((vibe: VibePost) => {
    setUserVibes(prev => [vibe, ...prev]);
    setSessionUserVibes(prev => [vibe, ...prev]);
    setActiveFilter('foryou');
    setCurrentIdx(0);
  }, []);

  // Action to refresh vibes and load new ones
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshOffsets(prev => ({
      ...prev,
      [activeFilter]: (prev[activeFilter] ?? 0) + 12 + Math.floor(Math.random() * 15) * 5
    }));
    setCurrentIdx(0);
    setLoading(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  }, [activeFilter, isRefreshing]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setCurrentIdx(0);
    setTimeout(() => {
      if (activeFilter === 'myvibes') {
        setVibes(userVibes);
        setLoading(false);
        return;
      }

      const baseOffset = filterSeedOffset[activeFilter] ?? 0;
      const rOffset = refreshOffsets[activeFilter] ?? 0;
      const offset = baseOffset + rOffset;

      // For "trending" sort by score desc already; "new" = reverse freshness; "following"/"nearby" = seeded different set
      let initial = assembleVibesFeed(mood, offset, 12);
      if (activeFilter === 'trending') initial = [...initial].sort((a, b) => b.vibeScore - a.vibeScore);
      if (activeFilter === 'new') initial = [...initial].sort((a, b) => b.createdAt - a.createdAt);
      
      // Your own recently posted vibes in this session lead the For You feed
      if (activeFilter === 'foryou' && sessionUserVibes.length > 0) {
        initial = [...sessionUserVibes, ...initial];
      }
      setVibes(initial);
      setLoading(false);
    }, 600);
  }, [mood, activeFilter, userVibes, refreshOffsets, sessionUserVibes]);

  // Load more when near end
  useEffect(() => {
    if (activeFilter === 'myvibes') return;
    if (!loadingMore && vibes.length > 0 && currentIdx >= vibes.length - 3) {
      setLoadingMore(true);
      setTimeout(() => {
        const baseOffset = filterSeedOffset[activeFilter] ?? 0;
        const rOffset = refreshOffsets[activeFilter] ?? 0;
        const offset = baseOffset + rOffset + vibes.length;
        const more = assembleVibesFeed(mood, offset, 8);
        setVibes(prev => [...prev, ...more]);
        setLoadingMore(false);
      }, 400);
    }
  }, [currentIdx, vibes.length, loadingMore, mood, activeFilter, refreshOffsets]);

  const goNext = useCallback(() => {
    setCurrentIdx(i => Math.min(i + 1, vibes.length - 1));
  }, [vibes.length]);

  const goPrev = useCallback(() => {
    setCurrentIdx(i => Math.max(i - 1, 0));
  }, []);

  // Keyboard arrows for desktop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowUp')   goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop;
    const height = container.clientHeight || 1;
    const index = Math.round(scrollPos / height);
    if (index !== currentIdx && index >= 0 && index < vibes.length) {
      setCurrentIdx(index);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current.querySelector('.snap-scroll-container');
      if (container) {
        const height = container.clientHeight;
        const targetScrollTop = currentIdx * height;
        if (Math.abs(container.scrollTop - targetScrollTop) > 10) {
          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentIdx]);

  const FILTERS = [
    { id: 'foryou',   label: '⚡ For You' },
    { id: 'following',label: '💜 Following' },
    { id: 'trending', label: '🔥 Trending' },
    { id: 'new',      label: '✨ Fresh' },
    { id: 'nearby',   label: '📍 Nearby' },
    { id: 'myvibes',  label: '👤 My Vibes' },
  ];

  if (loading) {
    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[500px] bg-black overflow-hidden flex flex-col">
        {/* Filter tabs — top overlay */}
        <div className="absolute top-7 left-0 right-[100px] z-30">
          <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => { setActiveFilter(f.id); setVibes([]); setLoading(true); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                  activeFilter === f.id
                    ? 'bg-[#B026FF] text-white shadow-lg shadow-[#B026FF]/40'
                    : 'bg-black/40 backdrop-blur text-white/60 border border-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Header action buttons on Top Right */}
        <div className="absolute top-7 right-4 z-30 flex items-center gap-2">
          {activeFilter !== 'myvibes' && (
            <button
              disabled
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center shadow-lg border border-white/10 text-white/30"
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
            </button>
          )}
          <button
            disabled
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B026FF]/50 to-[#00F0FF]/50 flex items-center justify-center shadow-lg border border-white/10 text-white/30"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full h-full bg-black flex items-center justify-center pt-16">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#B026FF] to-[#00F0FF] flex items-center justify-center shadow-2xl shadow-[#B026FF]/40">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
            <span className="text-white/60 font-bold tracking-widest text-xs uppercase">Loading Vibes…</span>
          </motion.div>
        </div>
      </div>
    );
  }

  if (vibes.length === 0) {
    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[500px] bg-black overflow-hidden flex flex-col">
        {/* Filter tabs — top overlay */}
        <div className="absolute top-7 left-0 right-[100px] z-30">
          <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => { setActiveFilter(f.id); setVibes([]); setLoading(true); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                  activeFilter === f.id
                    ? 'bg-[#B026FF] text-white shadow-lg shadow-[#B026FF]/40'
                    : 'bg-black/40 backdrop-blur text-white/60 border border-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Header action buttons on Top Right */}
        <div className="absolute top-7 right-4 z-30 flex items-center gap-2">
          {activeFilter !== 'myvibes' && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleRefresh}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center shadow-lg border border-white/10 text-white/80 hover:text-white"
              title="Refresh Vibes"
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{ repeat: isRefreshing ? Infinity : 0, duration: 1, ease: 'linear' }}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setIsCreateOpen(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B026FF] to-[#00F0FF] flex items-center justify-center shadow-lg border border-white/20 text-white"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-6 relative pt-16">
          <Play className="w-12 h-12 text-[#B026FF] mb-4 opacity-40 animate-pulse" />
          <h3 className="text-white font-bold text-lg mb-2">No Vibes Found</h3>
          <p className="text-white/40 text-sm max-w-xs mb-6">
            {activeFilter === 'myvibes' 
              ? "You haven't posted any vibes yet. Share your style with the world!"
              : "There are no vibes posted in this category yet. Be the first to share one!"}
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-white font-bold text-sm shadow-lg shadow-[#B026FF]/30 active:scale-95 transition-transform"
          >
            Create a Vibe
          </button>
        </div>
        <VibeCreateSheet
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          currentUser={currentUser}
          onPost={handlePosted}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px] bg-black overflow-hidden flex flex-col">
      {/* Filter tabs — top overlay */}
      <div className="absolute top-7 left-0 right-[100px] z-30">
        <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFilter(f.id); setVibes([]); setLoading(true); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                activeFilter === f.id
                  ? 'bg-[#B026FF] text-white shadow-lg shadow-[#B026FF]/40'
                  : 'bg-black/40 backdrop-blur text-white/60 border border-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header action buttons on Top Right */}
      <div className="absolute top-7 right-4 z-30 flex items-center gap-2">
        {/* Refresh Vibe Feed Button */}
        {activeFilter !== 'myvibes' && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleRefresh}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center shadow-lg border border-white/10 text-white/80 hover:text-white"
            title="Refresh Vibes"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : {}}
              transition={{ repeat: isRefreshing ? Infinity : 0, duration: 1, ease: 'linear' }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
          </motion.button>
        )}

        {/* Create Vibe Floating Button */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => setIsCreateOpen(true)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B026FF] to-[#00F0FF] flex items-center justify-center shadow-lg shadow-[#B026FF]/40 border border-white/20"
          title="Create a Vibe"
        >
          <Plus className="w-5 h-5 text-white" />
        </motion.button>
      </div>

      {/* Vibe Cards — full-screen snap scroll */}
      <div 
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto no-scrollbar snap-y snap-mandatory snap-scroll-container scroll-smooth"
      >
        {vibes.map((vibe, i) => (
          <div
            key={vibe.id}
            className="w-full h-full snap-start snap-always relative overflow-hidden shrink-0"
          >
            <VibeCard
              vibe={vibe}
              isActive={i === currentIdx}
              muted={muted}
              onToggleMute={() => setMuted(m => !m)}
              onNext={goNext}
              onPrev={goPrev}
              total={vibes.length}
              current={currentIdx}
            />
          </div>
        ))}

        {/* Loading more spinner */}
        {loadingMore && (
          <div className="w-full h-24 flex items-center justify-center bg-black snap-start">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-[#B026FF] border-t-transparent"
            />
          </div>
        )}
      </div>

      <VibeCreateSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        currentUser={currentUser}
        onPost={handlePosted}
      />
    </div>
  );
}
