import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw, Bot, Users, Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { saveGameScore } from '../lib/gamesStorage';
import { coinsForScore } from '../lib/coinsWallet';

type Color = 'w' | 'b';
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type Piece = { type: PieceType; color: Color } | null;
type Board = Piece[][];
type Mode = 'menu' | 'ai' | 'friend';
type Difficulty = 'easy' | 'medium' | 'hard';

const PIECE_UNICODE: Record<PieceType, Record<Color, string>> = {
  K: { w: '♔', b: '♚' }, Q: { w: '♕', b: '♛' }, R: { w: '♖', b: '♜' },
  B: { w: '♗', b: '♝' }, N: { w: '♘', b: '♞' }, P: { w: '♙', b: '♟' },
};

function initBoard(): Board {
  const b: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const order: PieceType[] = ['R','N','B','Q','K','B','N','R'];
  order.forEach((t, c) => { b[0][c] = { type: t, color: 'b' }; b[7][c] = { type: t, color: 'w' }; });
  for (let c = 0; c < 8; c++) { b[1][c] = { type: 'P', color: 'b' }; b[6][c] = { type: 'P', color: 'w' }; }
  return b;
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function getPseudoMoves(board: Board, r: number, c: number): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  const moves: [number, number][] = [];
  const enemy = (tr: number, tc: number) => board[tr][tc] && board[tr][tc]!.color !== color;
  const empty = (tr: number, tc: number) => !board[tr][tc];
  const slide = (dr: number, dc: number) => {
    let tr = r + dr, tc = c + dc;
    while (inBounds(tr, tc)) {
      if (empty(tr, tc)) { moves.push([tr, tc]); tr += dr; tc += dc; }
      else { if (enemy(tr, tc)) moves.push([tr, tc]); break; }
    }
  };
  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    if (inBounds(r+dir,c) && empty(r+dir,c)) { moves.push([r+dir,c]); if (r===startRow && empty(r+2*dir,c)) moves.push([r+2*dir,c]); }
    if (inBounds(r+dir,c+1) && enemy(r+dir,c+1)) moves.push([r+dir,c+1]);
    if (inBounds(r+dir,c-1) && enemy(r+dir,c-1)) moves.push([r+dir,c-1]);
  } else if (type === 'N') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
      const tr=r+dr, tc=c+dc; if (inBounds(tr,tc) && !board[tr][tc]?.color.includes(color.toString())) { if (empty(tr,tc)||enemy(tr,tc)) moves.push([tr,tc]); }
    });
  } else if (type === 'B') { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  else if (type === 'R') { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  else if (type === 'Q') { [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  else if (type === 'K') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => {
      const tr=r+dr,tc=c+dc; if (inBounds(tr,tc) && (empty(tr,tc)||enemy(tr,tc))) moves.push([tr,tc]);
    });
  }
  return moves;
}

function pieceValue(t: PieceType) { return {P:1,N:3,B:3,R:5,Q:9,K:0}[t]; }

function evalBoard(board: Board): number {
  let score = 0;
  board.forEach(row => row.forEach(p => { if (p) score += (p.color==='w'?-1:1) * pieceValue(p.type); }));
  return score;
}

function minimax(board: Board, depth: number, isMax: boolean, alpha: number, beta: number): number {
  if (depth === 0) return evalBoard(board);
  const color: Color = isMax ? 'b' : 'w';
  const allMoves: [number,number,number,number][] = [];
  board.forEach((row,r) => row.forEach((p,c) => { if (p?.color===color) getPseudoMoves(board,r,c).forEach(([tr,tc]) => allMoves.push([r,c,tr,tc])); }));
  if (allMoves.length===0) return isMax ? -1000 : 1000;
  let best = isMax ? -Infinity : Infinity;
  for (const [r,c,tr,tc] of allMoves) {
    const nb = board.map(row=>[...row]); nb[tr][tc]=nb[r][c]; nb[r][c]=null;
    const val = minimax(nb, depth-1, !isMax, alpha, beta);
    if (isMax) { best=Math.max(best,val); alpha=Math.max(alpha,val); } else { best=Math.min(best,val); beta=Math.min(beta,val); }
    if (beta<=alpha) break;
  }
  return best;
}

function getBestMove(board: Board, difficulty: Difficulty): [number,number,number,number] | null {
  const depth = difficulty==='easy'?1:difficulty==='medium'?2:3;
  const allMoves: [number,number,number,number][] = [];
  board.forEach((row,r)=>row.forEach((p,c)=>{ if(p?.color==='b') getPseudoMoves(board,r,c).forEach(([tr,tc])=>allMoves.push([r,c,tr,tc])); }));
  if (allMoves.length===0) return null;
  if (difficulty==='easy') return allMoves[Math.floor(Math.random()*allMoves.length)];
  let best=-Infinity, bestMove=allMoves[0];
  for (const [r,c,tr,tc] of allMoves) {
    const nb=board.map(row=>[...row]); nb[tr][tc]=nb[r][c]; nb[r][c]=null;
    const val=minimax(nb,depth-1,false,-Infinity,Infinity);
    if(val>best){best=val;bestMove=[r,c,tr,tc];}
  }
  return bestMove;
}

export default function ChessGameScreen() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [mode, setMode] = useState<Mode>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<Board>(initBoard());
  const [selected, setSelected] = useState<[number,number]|null>(null);
  const [highlights, setHighlights] = useState<[number,number][]>([]);
  const [turn, setTurn] = useState<Color>('w');
  const [status, setStatus] = useState('');
  const [captured, setCaptured] = useState<{w:Piece[],b:Piece[]}>({w:[],b:[]});
  const [moveCount, setMoveCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [lastMove, setLastMove] = useState<[number,number,number,number]|null>(null);

  useEffect(() => {
    if (gameOver) {
      const isWin = status.includes('White wins');
      const blackPiecesCapturedByPlayer = captured.w;
      const scoreValue = blackPiecesCapturedByPlayer.reduce((sum, p) => {
        if (!p) return sum;
        const val = {P:1,N:3,B:3,R:5,Q:9,K:0}[p.type] || 0;
        return sum + val;
      }, 0) * 100 + (isWin ? 1000 : 0);
      const finalScore = Math.max(100, scoreValue);
      
      saveGameScore('chess', finalScore, currentUser?.name || currentUser?.username || 'You', currentUser?.avatar);
      setCoinsEarned(coinsForScore('chess', finalScore));
    } else {
      setCoinsEarned(0);
    }
  }, [gameOver, status, captured.w, currentUser]);

  const startGame = (m: Mode) => {
    setMode(m); setBoard(initBoard()); setSelected(null); setHighlights([]);
    setTurn('w'); setStatus(''); setCaptured({w:[],b:[]}); setMoveCount(0); setGameOver(false); setLastMove(null);
  };

  const applyMove = useCallback((b: Board, fr: number, fc: number, tr: number, tc: number): Board => {
    const nb = b.map(row=>[...row]);
    nb[tr][tc] = nb[fr][fc];
    nb[fr][fc] = null;
    // Pawn promotion
    if (nb[tr][tc]?.type==='P') {
      if (tr===0 && nb[tr][tc]?.color==='w') nb[tr][tc] = {type:'Q',color:'w'};
      if (tr===7 && nb[tr][tc]?.color==='b') nb[tr][tc] = {type:'Q',color:'b'};
    }
    return nb;
  }, []);

  const handleSquare = useCallback((r: number, c: number) => {
    if (gameOver || aiThinking) return;
    const piece = board[r][c];
    if (selected) {
      const [sr,sc] = selected;
      if (highlights.some(([hr,hc])=>hr===r&&hc===c)) {
        const cap = board[r][c];
        const nb = applyMove(board,sr,sc,r,c);
        setBoard(nb);
        setLastMove([sr,sc,r,c]);
        if(cap) setCaptured(prev=>({...prev,[turn]:[...prev[turn],cap]}));
        if(cap?.type==='K'){setGameOver(true);setStatus(`${turn==='w'?'⚡ White':'💜 Black'} wins! 🏆`);setSelected(null);setHighlights([]);return;}
        const nextTurn: Color = turn==='w'?'b':'w';
        setTurn(nextTurn); setMoveCount(m=>m+1);
        setSelected(null); setHighlights([]);
        if(mode==='ai' && nextTurn==='b') { setAiThinking(true); }
        return;
      }
      if (piece?.color===turn) { setSelected([r,c]); setHighlights(getPseudoMoves(board,r,c)); return; }
      setSelected(null); setHighlights([]);
    } else {
      if (piece?.color===turn) { setSelected([r,c]); setHighlights(getPseudoMoves(board,r,c)); }
    }
  }, [board, selected, highlights, turn, mode, gameOver, aiThinking, applyMove]);

  useEffect(() => {
    if (!aiThinking || mode!=='ai') return;
    const t = setTimeout(() => {
      const mv = getBestMove(board, difficulty);
      if (mv) {
        const [fr,fc,tr,tc] = mv;
        const cap = board[tr][tc];
        const nb = applyMove(board,fr,fc,tr,tc);
        setBoard(nb);
        setLastMove(mv);
        if(cap) setCaptured(prev=>({...prev,b:[...prev.b,cap]}));
        if(cap?.type==='K'){setGameOver(true);setStatus('💜 Black wins! 🏆');}
        else setTurn('w');
      }
      setAiThinking(false);
    }, 300);
    return ()=>clearTimeout(t);
  }, [aiThinking, board, difficulty, mode, applyMove]);

  if (mode==='menu') return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center p-6">
      <button onClick={()=>navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-white"/></button>
      <div className="text-6xl mb-4">♟️</div>
      <h1 className="text-3xl font-black text-white mb-2">Chess</h1>
      <p className="text-white/50 text-sm mb-8">Classic strategy game</p>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-2">
          <p className="text-white/60 text-xs uppercase tracking-wider mb-3">AI Difficulty</p>
          <div className="flex gap-2">
            {(['easy','medium','hard'] as Difficulty[]).map(d=>(
              <button key={d} onClick={()=>setDifficulty(d)} className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${difficulty===d?'bg-[#00F0FF] text-black':'bg-white/5 text-white/60'}`}>{d}</button>
            ))}
          </div>
        </div>
        <button onClick={()=>startGame('ai')} className="w-full py-4 bg-gradient-to-r from-[#B026FF] to-[#00F0FF] rounded-2xl text-black font-black text-lg flex items-center justify-center gap-2"><Bot className="w-5 h-5"/>Play vs AI</button>
        <button onClick={()=>startGame('friend')} className="w-full py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2"><Users className="w-5 h-5"/>Pass & Play</button>
      </div>
    </div>
  );

  const files = ['a','b','c','d','e','f','g','h'];
  return (
    <div className="min-h-screen bg-[#080810] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={()=>setMode('menu')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-white"/></button>
        <div className="text-center">
          <h1 className="text-white font-black">Chess ♟️</h1>
          <p className="text-white/40 text-xs">{mode==='ai'?`vs AI (${difficulty})`:'Pass & Play'} · Move {moveCount}</p>
        </div>
        <button onClick={()=>startGame(mode)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><RotateCcw className="w-4 h-4 text-white"/></button>
      </div>

      {/* Captured by White */}
      <div className="px-4 py-1 flex flex-wrap gap-0.5 min-h-[24px]">
        {captured.w.map((p,i)=><span key={i} className="text-sm">{p && PIECE_UNICODE[p.type][p.color]}</span>)}
      </div>

      {/* Turn indicator */}
      <div className="px-4 py-2">
        {gameOver ? (
          <div className="space-y-2">
            <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl px-4 py-2 text-center text-yellow-400 font-bold">{status}</div>
            {coinsEarned > 0 && (
              <div className="flex items-center justify-center gap-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl py-1.5 px-3 text-xs text-yellow-400 font-black animate-pulse">
                🪙 +{coinsEarned.toLocaleString()} COINS EARNED!
              </div>
            )}
          </div>
        ) : (
          <div className={`rounded-xl px-4 py-2 text-center font-bold text-sm ${turn==='w'?'bg-white/10 text-white':'bg-[#B026FF]/20 text-[#B026FF]'}`}>
            {aiThinking?'🤖 AI thinking...':`${turn==='w'?'⚡ White':'💜 Black'}'s turn`}
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-2">
        <div className="relative">
          <div className="grid grid-cols-8 border-2 border-white/20 rounded-lg overflow-hidden shadow-2xl" style={{width:'min(96vw,420px)',height:'min(96vw,420px)'}}>
            {board.map((row,r)=>row.map((piece,c)=>{
              const isLight=(r+c)%2===0;
              const isSelected=selected?.[0]===r&&selected?.[1]===c;
              const isHighlighted=highlights.some(([hr,hc])=>hr===r&&hc===c);
              const isLastMove=lastMove&&((lastMove[0]===r&&lastMove[1]===c)||(lastMove[2]===r&&lastMove[3]===c));
              let bg=isLight?'#E8D5A3':'#B08050';
              if(isSelected) bg='#00F0FF';
              else if(isLastMove) bg=isLight?'#F6F669':'#BACA2B';
              return (
                <div key={`${r}-${c}`} onClick={()=>handleSquare(r,c)} className="relative flex items-center justify-center cursor-pointer transition-all"
                  style={{backgroundColor:bg,width:'12.5%',height:'12.5%',aspectRatio:'1'}}>
                  {isHighlighted&&<div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                    {piece?<div className="absolute inset-0 border-4 border-[#00F0FF] rounded-sm opacity-80"/>:<div className="w-3 h-3 rounded-full bg-[#00F0FF] opacity-70"/>}
                  </div>}
                  {piece&&<span className="text-2xl select-none drop-shadow-md" style={{fontSize:'min(7vw,30px)'}}>{PIECE_UNICODE[piece.type][piece.color]}</span>}
                </div>
              );
            }))}
          </div>
          {/* File labels */}
          <div className="flex justify-around mt-1 px-0.5">
            {files.map(f=><span key={f} className="text-white/30 text-[10px] w-[12.5%] text-center">{f}</span>)}
          </div>
        </div>
      </div>

      {/* Captured by Black */}
      <div className="px-4 py-1 flex flex-wrap gap-0.5 min-h-[24px]">
        {captured.b.map((p,i)=><span key={i} className="text-sm">{p && PIECE_UNICODE[p.type][p.color]}</span>)}
      </div>

      {gameOver&&<div className="px-4 pb-6">
        <button onClick={()=>startGame(mode)} className="w-full py-3 bg-gradient-to-r from-[#B026FF] to-[#00F0FF] rounded-2xl text-black font-black">Play Again</button>
      </div>}
    </div>
  );
}
