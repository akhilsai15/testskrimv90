import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import {
  Zap, MessageCircle, Share2, Bookmark, Volume2, VolumeX,
  Music, Heart, Play, ChevronUp, ChevronDown, Search, X,
  MoreHorizontal, Plus, Images, Video, RefreshCw,
} from 'lucide-react';
import { assembleVibesFeed, getDefaultMood, MOODS, MOCK_USERS, type VibePost } from '../lib/mock/skrimAlgorithm';
import { incrementStat } from '../lib/mock/achievementEngine';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { MusicPicker } from '../components/MusicPicker';

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
}: {
  vibe: VibePost;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [liked, setLiked]   = useState(() => {
    try {
      if (!vibe?.id) return false;
      const l: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_liked') || '[]');
      return Array.isArray(l) && l.includes(vibe.id);
    } catch { return false; }
  });
  const [saved, setSaved]   = useState(() => {
    try {
      if (!vibe?.id) return false;
      const s: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_saved') || '[]');
      return Array.isArray(s) && s.includes(vibe.id);
    } catch { return false; }
  });
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
  const lastTap = useRef(0);

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
    }
    lastTap.current = now;
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.y < -60) onNext();
    if (info.offset.y >  60) onPrev();
    dragY.set(0);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      {/* Background — a real <video> for user-uploaded clips, otherwise the
          existing mock thumbnail image (mock Vibes have no actual video file). */}
      {vibe.videoSrc ? (
        <motion.video
          src={vibe.videoSrc}
          autoPlay={isActive}
          loop
          muted={muted}
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ scale: imgScale }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
      ) : (
        <motion.img
          src={vibe.thumbnail}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ scale: imgScale }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          draggable={false}
        />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />

      {/* Drag-to-swipe layer */}
      <motion.div
        className="absolute inset-0 z-10"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        style={{ y: dragY }}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
      />

      {/* ── Top bar ─────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-safe">
        {/* Progress bars */}
        <div className="pt-3 pb-2">
          <ProgressBars total={10} current={0} />
        </div>

        {/* Mute + More */}
        <div className="flex justify-between items-center px-4 mt-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={onToggleMute}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center border border-white/10"
          >
            {muted
              ? <VolumeX className="w-4 h-4 text-white" />
              : <Volume2 className="w-4 h-4 text-white" />
            }
          </motion.button>
          <motion.button whileTap={{ scale: 0.8 }}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center border border-white/10">
            <MoreHorizontal className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>

      {/* ── Right action column ──────────────────── */}
      <div className="absolute right-3 bottom-36 z-20 flex flex-col gap-5 items-center">
        {/* Avatar + follow */}
        <div className="relative">
          <img src={vibe.avatar} alt={vibe.user} className="w-12 h-12 rounded-full border-2 border-[#B026FF] object-cover" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#B026FF] flex items-center justify-center shadow-lg shadow-[#B026FF]/40">
            <Plus className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Pulse (like) */}
        <ActionBtn
          icon={<Zap className={`w-6 h-6 ${liked ? 'text-[#B026FF] fill-[#B026FF]' : 'text-white'}`} />}
          label={fmt(pulses)}
          active={liked}
          color="#B026FF"
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
          }}
        />

        {/* Comments */}
        <ActionBtn
          icon={<MessageCircle className="w-6 h-6 text-white" />}
          label={fmt(commentCount)}
          onClick={() => setShowComments(true)}
        />

        {/* Share */}
        <ActionBtn
          icon={<Share2 className="w-6 h-6 text-white" />}
          label={fmt(vibe.shares)}
          onClick={() => incrementStat('shares', 1)}
        />

        {/* Save */}
        <ActionBtn
          icon={<Bookmark className={`w-6 h-6 ${saved ? 'text-[#00F0FF] fill-[#00F0FF]' : 'text-white'}`} />}
          label={fmt(vibe.saves)}
          active={saved}
          color="#00F0FF"
          onClick={() => setSaved(s => {
            const next = !s;
            try {
              const arr: string[] = JSON.parse(localStorage.getItem('skrimchat_vibe_saved') || '[]');
              const updated = next ? [...arr.filter(x => x !== vibe.id), vibe.id] : arr.filter(x => x !== vibe.id);
              localStorage.setItem('skrimchat_vibe_saved', JSON.stringify(updated));
            } catch (e) {}
            return next;
          })}
        />

        {/* Rotating vinyl */}
        <motion.div
          animate={isActive ? { rotate: 360 } : {}}
          transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#B026FF] to-[#00F0FF] flex items-center justify-center shadow-lg shadow-[#B026FF]/40 border-2 border-white/20"
        >
          <Music className="w-5 h-5 text-white" />
        </motion.div>
      </div>

      {/* ── Bottom info ──────────────────────────── */}
      <div className="absolute left-0 right-16 bottom-24 z-20 px-4 flex flex-col gap-2">
        {/* User info */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm drop-shadow">{vibe.user}</span>
          <span className="text-[10px] text-[#B026FF] font-bold border border-[#B026FF]/40 px-1.5 py-0.5 rounded-full">
            {vibe.creatorTier}
          </span>
        </div>
        <span className="text-white/50 text-xs">{vibe.handle}</span>

        <Caption text={vibe.caption} />

        {/* Audio ticker */}
        <div className="flex items-center gap-2 bg-black/30 backdrop-blur rounded-full px-3 py-1.5 w-fit mt-1">
          <Music className="w-3 h-3 text-[#B026FF] shrink-0" />
          <div className="overflow-hidden w-40">
            <motion.span
              className="text-[11px] text-white/80 whitespace-nowrap block"
              animate={{ x: [0, -120, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            >
              {vibe.audio} &nbsp;&nbsp;&nbsp; {vibe.audio}
            </motion.span>
          </div>
        </div>

        {/* Vibe score badge */}
        <div className="flex items-center gap-1.5 mt-1">
          <div
            className="px-2 py-0.5 rounded-full text-[10px] font-black border"
            style={{
              borderColor: vibe.vibeScore > 75 ? '#FF2D87' : vibe.vibeScore > 50 ? '#FF6B00' : '#4488FF',
              color:       vibe.vibeScore > 75 ? '#FF2D87' : vibe.vibeScore > 50 ? '#FF6B00' : '#4488FF',
              background:  vibe.vibeScore > 75 ? 'rgba(255,45,135,0.12)' : vibe.vibeScore > 50 ? 'rgba(255,107,0,0.12)' : 'rgba(68,136,255,0.12)',
            }}
          >
            {vibe.vibeScore > 75 ? '🚀 NOVA' : vibe.vibeScore > 50 ? '🔥 HOT' : '😐 WARMING'}
          </div>
          <span className="text-white/30 text-[10px]">Vibe Score {vibe.vibeScore.toFixed(0)}</span>
        </div>
      </div>

      {/* ── Swipe hint arrows ───────────────────── */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-8 opacity-30 pointer-events-none">
        <ChevronUp className="w-5 h-5 text-white" />
        <ChevronDown className="w-5 h-5 text-white" />
      </div>

      {/* Heart burst animation */}
      {burst && (
        <HeartBurst x={burst.x} y={burst.y} onDone={() => setBurst(null)} />
      )}

      {/* Comments drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-xl rounded-t-3xl pt-4 pb-8"
            style={{ height: '65%' }}
          >
            <div className="flex items-center justify-between px-5 mb-4">
              <span className="font-bold text-white">{fmt(commentCount)} Comments</span>
              <button onClick={() => setShowComments(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <img src={`https://i.pravatar.cc/150?img=${i + 20}`} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                  <div>
                    <span className="text-[#B026FF] text-xs font-bold">@user_{i + 1} </span>
                    <span className="text-white/80 text-sm">
                      {["bhai ekdum fire hai 🔥", "yaar yeh too good 😭", "iske jaisi content koi nahi banata seriously 💜",
                        "screenshot liya 📸 pure gold", "share kardunga aaj raat ko 🚀", "nostalgia hit kiya yaar ❤️"][i]}
                    </span>
                    <div className="text-white/30 text-xs mt-0.5">{i + 1}h ago · {(i + 1) * 47} ⚡</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Comment input */}
            <div className="px-4 mt-3 flex gap-2 items-center">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white/50">
                Add a comment…
              </div>
              <button
                className="w-10 h-10 rounded-full bg-[#B026FF] flex items-center justify-center"
                onClick={() => {
                  setCommentCount(c => c + 1);
                  try {
                    const cc: Record<string,number> = JSON.parse(localStorage.getItem('skrimchat_vibe_comments') || '{}');
                    cc[vibe.id] = (cc[vibe.id] || vibe.comments) + 1;
                    localStorage.setItem('skrimchat_vibe_comments', JSON.stringify(cc));
                  } catch (e) {}
                }}
              >
                <Zap className="w-4 h-4 text-white fill-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  // Filter → seed offset so each tab produces different content
  const filterSeedOffset: Record<string, number> = {
    foryou: 0, following: 500, trending: 1000, new: 1500, nearby: 2000,
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Vibes you've actually posted, persisted in localStorage. Loaded once and
  // merged into the feed below — keeping it separate from `vibes` (which gets
  // wiped/refetched on every filter change) means your own posts survive that.
  const [userVibes, setUserVibes] = useState<VibePost[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('skrimchat_user_vibes') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const handlePosted = useCallback((vibe: VibePost) => {
    setUserVibes(prev => [vibe, ...prev]);
    setActiveFilter('foryou');
    setCurrentIdx(0);
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setCurrentIdx(0);
    setTimeout(() => {
      const offset = filterSeedOffset[activeFilter] ?? 0;
      // For "trending" sort by score desc already; "new" = reverse freshness; "following"/"nearby" = seeded different set
      let initial = assembleVibesFeed(mood, offset, 12);
      if (activeFilter === 'trending') initial = [...initial].sort((a, b) => b.vibeScore - a.vibeScore);
      if (activeFilter === 'new') initial = [...initial].sort((a, b) => b.createdAt - a.createdAt);
      // Your own posts lead the For You feed, newest first — same idea as
      // Pulse prepending fresh posts instead of waiting for a refetch.
      if (activeFilter === 'foryou' && userVibes.length > 0) initial = [...userVibes, ...initial];
      setVibes(initial);
      setLoading(false);
    }, 600);
  }, [mood, activeFilter, userVibes]);

  // Load more when near end
  useEffect(() => {
    if (!loadingMore && vibes.length > 0 && currentIdx >= vibes.length - 3) {
      setLoadingMore(true);
      setTimeout(() => {
        const offset = (filterSeedOffset[activeFilter] ?? 0) + vibes.length;
        const more = assembleVibesFeed(mood, offset, 8);
        setVibes(prev => [...prev, ...more]);
        setLoadingMore(false);
      }, 400);
    }
  }, [currentIdx, vibes.length, loadingMore, mood]);

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
  ];

  if (loading) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
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
    );
  }

  if (vibes.length === 0) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-6 relative">
        <div className="absolute top-0 left-0 right-0 z-30 pt-2">
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
        <Play className="w-12 h-12 text-[#B026FF] mb-4 opacity-40 animate-pulse" />
        <h3 className="text-white font-bold text-lg mb-2">No Vibes Found</h3>
        <p className="text-white/40 text-sm max-w-xs mb-6">
          There are no vibes posted in this category yet. Be the first to share one!
        </p>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-white font-bold text-sm shadow-lg shadow-[#B026FF]/30 active:scale-95 transition-transform"
        >
          Create a Vibe
        </button>
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
      <div className="absolute top-0 left-0 right-0 z-30 pt-2">
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

      {/* Counter pill */}
      <div className="absolute top-14 right-4 z-30 bg-black/50 backdrop-blur rounded-full px-2.5 py-1 text-[10px] text-white/60 font-bold pointer-events-none">
        {currentIdx + 1} / {vibes.length}
      </div>

      {/* Create Vibe — there was previously no way to post one at all;
          this is the equivalent of Pulse's "+" composer entry point. */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setIsCreateOpen(true)}
        className="absolute bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-[#B026FF] to-[#00F0FF] flex items-center justify-center shadow-lg shadow-[#B026FF]/40 border-2 border-white/10"
      >
        <Plus className="w-7 h-7 text-white" />
      </motion.button>

      <VibeCreateSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        currentUser={currentUser}
        onPost={handlePosted}
      />
    </div>
  );
}
