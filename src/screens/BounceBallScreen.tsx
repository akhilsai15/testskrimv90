import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw } from 'lucide-react';

const W = 360, H = 500;
const PADDLE_W = 70, PADDLE_H = 10, BALL_R = 8;

interface Brick { x: number; y: number; w: number; h: number; hp: number; color: string; points: number; }
interface Ball { x: number; y: number; vx: number; vy: number; }

const LEVEL_CONFIGS = [
  { rows: 3, cols: 7, speed: 4, brickHp: 1 },
  { rows: 4, cols: 8, speed: 4.5, brickHp: 1 },
  { rows: 4, cols: 8, speed: 5, brickHp: 2 },
  { rows: 5, cols: 8, speed: 5, brickHp: 2 },
  { rows: 5, cols: 9, speed: 5.5, brickHp: 2 },
  { rows: 6, cols: 9, speed: 5.5, brickHp: 3 },
  { rows: 6, cols: 9, speed: 6, brickHp: 3 },
  { rows: 7, cols: 9, speed: 6, brickHp: 3 },
  { rows: 7, cols: 9, speed: 6.5, brickHp: 4 },
  { rows: 8, cols: 9, speed: 7, brickHp: 4 },
];

const BRICK_COLORS = ['#FF4444','#FF8844','#FFCC44','#44CC44','#4488FF','#8844FF','#FF44CC','#44CCCC'];
const HP_COLORS: Record<number,string> = { 1:'#FF4444', 2:'#FF8844', 3:'#FFCC44', 4:'#44CC44' };

function buildBricks(level: number): Brick[] {
  const cfg = LEVEL_CONFIGS[Math.min(level-1, LEVEL_CONFIGS.length-1)];
  const bricks: Brick[] = [];
  const bw = (W - 20) / cfg.cols;
  const bh = 18;
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const hp = Math.ceil(Math.random() * cfg.brickHp);
      bricks.push({
        x: 10 + c * bw, y: 40 + r * (bh + 4),
        w: bw - 3, h: bh, hp, color: BRICK_COLORS[r % BRICK_COLORS.length],
        points: hp * 10,
      });
    }
  }
  return bricks;
}

export default function BounceBallScreen() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | undefined>(undefined);
  const stateRef = useRef({
    ball: { x: W/2, y: H - 60, vx: 3, vy: -4 } as Ball,
    paddle: W/2 - PADDLE_W/2,
    bricks: [] as Brick[],
    lives: 3,
    score: 0,
    running: false,
    gameOver: false,
    win: false,
    level: 1,
  });
  const [displayState, setDisplayState] = useState({ lives: 3, score: 0, level: 1, gameOver: false, win: false, started: false });
  const touchRef = useRef<number|null>(null);

  const resetBall = () => {
    const s = stateRef.current;
    const cfg = LEVEL_CONFIGS[Math.min(s.level-1, LEVEL_CONFIGS.length-1)];
    const angle = (Math.random() * 60 + 60) * (Math.PI/180);
    s.ball = { x: W/2, y: H - 60, vx: Math.cos(angle) * cfg.speed * (Math.random()>0.5?1:-1), vy: -Math.abs(Math.sin(angle) * cfg.speed) };
    s.running = false;
  };

  const startLevel = useCallback((lv: number) => {
    const s = stateRef.current;
    s.level = lv; s.bricks = buildBricks(lv); s.lives = 3; s.score = 0;
    s.gameOver = false; s.win = false; s.paddle = W/2 - PADDLE_W/2;
    resetBall();
    setDisplayState({ lives: 3, score: 0, level: lv, gameOver: false, win: false, started: true });
  }, []);

  const handleMove = useCallback((clientX: number, rect: DOMRect) => {
    const x = (clientX - rect.left) * (W / rect.width);
    stateRef.current.paddle = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W/2));
    if (!stateRef.current.running && !stateRef.current.gameOver && !stateRef.current.win) {
      stateRef.current.running = true;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const loop = () => {
      const s = stateRef.current;
      ctx.fillStyle = '#080810'; ctx.fillRect(0, 0, W, H);

      // Draw bricks
      s.bricks.forEach(b => {
        ctx.fillStyle = HP_COLORS[b.hp] || b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
        if (b.hp > 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(`${b.hp}`, b.x + b.w/2, b.y + b.h/2 + 3);
        }
      });

      // Draw paddle
      const grad = ctx.createLinearGradient(s.paddle, 0, s.paddle + PADDLE_W, 0);
      grad.addColorStop(0, '#B026FF'); grad.addColorStop(1, '#00F0FF');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(s.paddle, H - 30, PADDLE_W, PADDLE_H, 5); ctx.fill();

      // Draw ball
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI*2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(s.ball.x - 2, s.ball.y - 2, BALL_R/3, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();

      // Lives
      for (let i = 0; i < s.lives; i++) {
        ctx.beginPath(); ctx.arc(15 + i*20, 20, 6, 0, Math.PI*2);
        ctx.fillStyle = '#FF4444'; ctx.fill();
      }

      if (s.running && !s.gameOver && !s.win) {
        const b = s.ball;
        b.x += b.vx; b.y += b.vy;

        // Wall bounce
        if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
        if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
        if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

        // Paddle
        if (b.y + BALL_R >= H - 30 && b.y + BALL_R <= H - 20 && b.x >= s.paddle - 5 && b.x <= s.paddle + PADDLE_W + 5) {
          b.vy = -Math.abs(b.vy);
          const hit = (b.x - s.paddle) / PADDLE_W - 0.5;
          b.vx = hit * 8;
          const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
          const cfg = LEVEL_CONFIGS[Math.min(s.level-1, LEVEL_CONFIGS.length-1)];
          if (speed > cfg.speed * 1.5) { b.vx *= cfg.speed * 1.5 / speed; b.vy *= cfg.speed * 1.5 / speed; }
        }

        // Fall off
        if (b.y - BALL_R > H) {
          s.lives--;
          setDisplayState(d => ({...d, lives: s.lives}));
          if (s.lives <= 0) { s.gameOver = true; s.running = false; setDisplayState(d=>({...d,gameOver:true})); }
          else resetBall();
        }

        // Brick collision
        for (let i = s.bricks.length - 1; i >= 0; i--) {
          const br = s.bricks[i];
          if (b.x + BALL_R > br.x && b.x - BALL_R < br.x + br.w && b.y + BALL_R > br.y && b.y - BALL_R < br.y + br.h) {
            const overlapL = b.x + BALL_R - br.x, overlapR = br.x + br.w - (b.x - BALL_R);
            const overlapT = b.y + BALL_R - br.y, overlapB = br.y + br.h - (b.y - BALL_R);
            const minH = Math.min(overlapL, overlapR), minV = Math.min(overlapT, overlapB);
            if (minH < minV) b.vx = overlapL < overlapR ? -Math.abs(b.vx) : Math.abs(b.vx);
            else b.vy = overlapT < overlapB ? -Math.abs(b.vy) : Math.abs(b.vy);
            br.hp--;
            if (br.hp <= 0) { s.score += br.points; s.bricks.splice(i, 1); setDisplayState(d=>({...d,score:s.score})); }
            break;
          }
        }

        if (s.bricks.length === 0) {
          s.win = true; s.running = false;
          setDisplayState(d=>({...d,win:true,score:s.score}));
        }
      } else if (!s.running && !s.gameOver && !s.win) {
        // Show "tap to start" ball idle
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Move paddle to launch!', W/2, H/2 + 30);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current!);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX, canvas.getBoundingClientRect());
    const onTouch = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, canvas.getBoundingClientRect()); };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    return () => { canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('touchmove', onTouch); canvas.removeEventListener('touchstart', onTouch); };
  }, [handleMove]);

  const ds = displayState;

  if (!ds.started) return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center p-6">
      <button onClick={()=>navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-white"/></button>
      <div className="text-6xl mb-4">🏀</div>
      <h1 className="text-3xl font-black text-white mb-1">Bounce Ball</h1>
      <p className="text-white/50 text-sm mb-8">Break all bricks! 10 levels</p>
      <div className="w-full max-w-xs flex flex-col gap-3">
        {[1,2,3,4,5,6,7,8,9,10].map(lv=>(
          <button key={lv} onClick={()=>startLevel(lv)} className={`w-full py-3 rounded-2xl font-black text-sm border transition-all ${lv===1?'bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-black border-transparent':'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
            Level {lv} {lv===1?'— Beginner':lv<=3?'— Easy':lv<=6?'— Medium':lv<=8?'— Hard':'— Expert'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={()=>setDisplayState(d=>({...d,started:false}))} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-white"/></button>
        <div className="text-center"><p className="text-white font-black text-sm">Bounce Ball 🏀</p><p className="text-white/40 text-xs">Level {ds.level} · Score: {ds.score}</p></div>
        <button onClick={()=>startLevel(ds.level)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><RotateCcw className="w-4 h-4 text-white"/></button>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        <canvas ref={canvasRef} width={W} height={H} style={{width:'100%',maxWidth:`${W}px`,touchAction:'none',cursor:'none'}}/>
        {(ds.gameOver||ds.win)&&(
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-[#12121C] border border-white/20 rounded-3xl p-8 text-center mx-4">
              <div className="text-5xl mb-3">{ds.win?'🏆':'💥'}</div>
              <h2 className="text-white font-black text-2xl mb-1">{ds.win?'Level Clear!':'Game Over!'}</h2>
              <p className="text-white/60 text-sm mb-6">Score: {ds.score}</p>
              <div className="flex gap-3">
                {ds.win && ds.level < 10 && <button onClick={()=>startLevel(ds.level+1)} className="flex-1 py-3 bg-gradient-to-r from-[#B026FF] to-[#00F0FF] rounded-2xl text-black font-black text-sm">Level {ds.level+1} →</button>}
                <button onClick={()=>startLevel(ds.level)} className="flex-1 py-3 bg-white/10 border border-white/20 rounded-2xl text-white font-bold text-sm">Retry</button>
                <button onClick={()=>setDisplayState(d=>({...d,started:false}))} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/60 font-bold text-sm">Levels</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
