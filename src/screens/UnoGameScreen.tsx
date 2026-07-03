import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { saveGameScore } from '../lib/gamesStorage';
import { coinsForScore } from '../lib/coinsWallet';

type Color = 'red'|'blue'|'green'|'yellow'|'wild';
type Value = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'Skip'|'Reverse'|'+2'|'Wild'|'+4';
interface Card { id: string; color: Color; value: Value; }

const COLORS: Color[] = ['red','blue','green','yellow'];
const VALUES: Value[] = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2'];
const COLOR_MAP: Record<Color,string> = {red:'bg-red-600 border-red-400',blue:'bg-blue-600 border-blue-400',green:'bg-green-600 border-green-400',yellow:'bg-yellow-500 border-yellow-300',wild:'bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500 border-white/30'};
const COLOR_TEXT: Record<Color,string> = {red:'text-red-400',blue:'text-blue-400',green:'text-green-400',yellow:'text-yellow-400',wild:'text-white'};

let _id = 0;
function mkCard(c: Color, v: Value): Card { return {id:`card-${_id++}`,color:c,value:v}; }

function buildDeck(): Card[] {
  const deck: Card[] = [];
  COLORS.forEach(c=>{
    deck.push(mkCard(c,'0'));
    VALUES.slice(1).forEach(v=>{ deck.push(mkCard(c,v)); deck.push(mkCard(c,v)); });
  });
  for(let i=0;i<4;i++){ deck.push(mkCard('wild','Wild')); deck.push(mkCard('wild','+4')); }
  return deck.sort(()=>Math.random()-0.5);
}

function canPlay(card: Card, top: Card, activeColor: Color): boolean {
  if(card.color==='wild') return true;
  return card.color===activeColor || card.value===top.value;
}

export default function UnoGameScreen() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [deck, setDeck] = useState<Card[]>([]);
  const [hands, setHands] = useState<Card[][]>([[],[]]);
  const [pile, setPile] = useState<Card[]>([]);
  const [activeColor, setActiveColor] = useState<Color>('red');
  const [turn, setTurn] = useState(0);
  const [direction, setDirection] = useState(1);
  const [drawPenalty, setDrawPenalty] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');
  const [unoAlert, setUnoAlert] = useState('');
  const [choosingColor, setChoosingColor] = useState(false);
  const [pendingCard, setPendingCard] = useState<Card|null>(null);
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState('');
  const [coinsEarned, setCoinsEarned] = useState(0);

  useEffect(() => {
    if (gameOver) {
      const finalScore = winner === 'Player 1' ? 1000 : 200;
      saveGameScore('uno', finalScore, currentUser?.name || currentUser?.username || 'You', currentUser?.avatar);
      setCoinsEarned(coinsForScore('uno', finalScore));
    } else {
      setCoinsEarned(0);
    }
  }, [gameOver, winner, currentUser]);

  const initGame = () => {
    const d = buildDeck();
    const h1 = d.splice(0,7), h2 = d.splice(0,7);
    let topIdx = d.findIndex(c=>c.color!=='wild');
    if(topIdx===-1) topIdx=0;
    const [top] = d.splice(topIdx,1);
    setDeck(d); setHands([h1,h2]); setPile([top]); setActiveColor(top.color as Color);
    setTurn(0); setDirection(1); setDrawPenalty(0); setGameOver(false); setWinner('');
    setUnoAlert(''); setChoosingColor(false); setPendingCard(null); setStarted(true); setMessage('');
  };

  const drawCard = () => {
    if(gameOver||choosingColor) return;
    const count = drawPenalty>0?drawPenalty:1;
    setDeck(d=>{
      let nd = [...d];
      if(nd.length<count){ const rePile=pile.slice(0,-1).sort(()=>Math.random()-0.5); nd=[...nd,...rePile]; }
      const drawn = nd.splice(0,count);
      setHands(h=>{ const nh=[...h]; nh[turn]=[...nh[turn],...drawn]; return nh; });
      return nd;
    });
    setDrawPenalty(0);
    setMessage(`Player ${turn+1} drew ${count} card${count>1?'s':''}`);
    const next = (turn + direction + 2) % 2;
    setTurn(next);
  };

  const playCard = (cardIdx: number) => {
    if(gameOver||choosingColor) return;
    const card = hands[turn][cardIdx];
    const top = pile[pile.length-1];
    if(drawPenalty>0 && card.value!=='+2' && card.value!=='+4') { setMessage("You must draw first!"); return; }
    if(!canPlay(card,top,activeColor)) { setMessage("Can't play that card!"); return; }
    setMessage('');
    const newHand = hands[turn].filter((_,i)=>i!==cardIdx);
    setHands(h=>{ const nh=[...h]; nh[turn]=newHand; return nh; });
    setPile(p=>[...p,card]);

    if(newHand.length===0){ setGameOver(true); setWinner(`Player ${turn+1}`); return; }
    if(newHand.length===1) setUnoAlert(`🃏 Player ${turn+1} says UNO!`);

    if(card.color==='wild'){ setPendingCard(card); setChoosingColor(true); return; }
    applyEffect(card, card.color as Color);
  };

  const applyEffect = (card: Card, color: Color) => {
    setActiveColor(color);
    let nextDir = direction;
    let skip = false;
    let penalty = 0;
    if(card.value==='Reverse') nextDir = -direction;
    if(card.value==='Skip') skip=true;
    if(card.value==='+2') penalty=2;
    if(card.value==='+4') penalty=4;
    setDirection(nextDir);
    setDrawPenalty(p=>p+penalty);
    const next = skip ? turn : (turn + nextDir + 2) % 2;
    setTurn(next);
  };

  const chooseColor = (c: Color) => {
    setChoosingColor(false);
    if(pendingCard) applyEffect(pendingCard, c);
    setPendingCard(null);
  };

  const top = pile[pile.length-1];
  const playerHand = hands[turn] || [];

  if(!started) return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center p-6">
      <button onClick={()=>navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-white"/></button>
      <div className="text-6xl mb-4">🃏</div>
      <h1 className="text-4xl font-black text-white mb-1">UNO</h1>
      <p className="text-white/50 text-sm mb-8">Pass & Play · 2 Players</p>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 max-w-xs text-sm text-white/60 space-y-2">
        <p>🎯 First to empty hand wins</p><p>🔄 Reverse changes direction</p>
        <p>🚫 Skip loses a turn</p><p>+2/+4 forces draws</p><p>🌈 Wild changes color</p>
      </div>
      <button onClick={initGame} className="w-full max-w-xs py-4 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-2xl text-white font-black text-xl">Deal Cards!</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col select-none">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <button onClick={()=>setStarted(false)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-white"/></button>
        <div className="text-center">
          <p className="text-white font-black text-sm">UNO 🃏</p>
          <p className={`text-xs font-bold ${turn===0?'text-[#00F0FF]':'text-[#B026FF]'}`}>Player {turn+1}'s turn</p>
        </div>
        <button onClick={initGame} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><RotateCcw className="w-4 h-4 text-white"/></button>
      </div>

      {/* Opponent hand */}
      <div className="flex items-center justify-center gap-1 py-3 px-4">
        {hands[1-turn].map((_,i)=>(
          <div key={i} className="w-8 h-12 bg-gradient-to-br from-[#B026FF] to-[#00F0FF] rounded-lg border border-white/20 flex items-center justify-center text-xs font-black text-white" style={{marginLeft:i>0?-16:0}}>🃏</div>
        ))}
        <span className="text-white/50 text-xs ml-2">{hands[1-turn].length} cards</span>
      </div>

      {/* Pile & deck */}
      <div className="flex items-center justify-center gap-8 py-4">
        <button onClick={drawCard} className="w-16 h-24 bg-gradient-to-br from-[#B026FF] to-[#00F0FF] rounded-2xl border-2 border-white/30 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-lg">
          <span className="text-2xl">🃏</span>
          {drawPenalty>0&&<span className="text-white text-[10px] font-black bg-red-600 px-1.5 rounded-full">+{drawPenalty}</span>}
          <span className="text-white/50 text-[9px]">{deck.length}</span>
        </button>
        {top&&(
          <div className={`w-16 h-24 ${COLOR_MAP[activeColor]} rounded-2xl border-2 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>
            <span className="text-white font-black text-2xl leading-none">{top.value==='Wild'?'🌈':top.value==='+4'?'+4':top.value}</span>
            <span className="text-white/70 text-[9px] mt-1">{activeColor}</span>
          </div>
        )}
      </div>

      {message&&<p className="text-center text-red-400 text-xs font-bold px-4">{message}</p>}
      {unoAlert&&<p className="text-center text-yellow-400 text-xs font-bold px-4">{unoAlert}</p>}

      {/* Player hand */}
      <div className="flex-1 flex flex-col justify-end">
        <p className="text-center text-white/50 text-xs mb-2">Your hand ({playerHand.length} cards)</p>
        <div className="flex overflow-x-auto no-scrollbar gap-1 px-3 pb-6" style={{paddingLeft:'8px'}}>
          {playerHand.map((card,i)=>{
            const playable = canPlay(card, top, activeColor) && (drawPenalty===0||card.value==='+2'||card.value==='+4');
            return (
              <motion.button key={card.id} onClick={()=>playCard(i)} whileTap={{scale:0.9}} whileHover={{y:-8}}
                className={`shrink-0 w-14 h-20 ${COLOR_MAP[card.color]} rounded-xl border-2 flex flex-col items-center justify-center transition-all ${playable?'shadow-[0_0_12px_rgba(255,255,255,0.3)]':'opacity-50'}`}
                style={{marginLeft:i>0?-20:0}}>
                <span className="text-white font-black text-base leading-none">{card.value==='Wild'?'🌈':card.value==='+4'?'+4':card.value}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Color chooser */}
      <AnimatePresence>{choosingColor&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#12121C] border border-white/20 rounded-3xl p-6 mx-4 text-center">
            <p className="text-white font-black text-lg mb-4">Choose Color</p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map(c=>(
                <button key={c} onClick={()=>chooseColor(c)} className={`${COLOR_MAP[c]} py-4 px-6 rounded-2xl border-2 text-white font-black capitalize text-lg active:scale-95 transition-transform`}>{c}</button>
              ))}
            </div>
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* Game Over */}
      <AnimatePresence>{gameOver&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-[#12121C] border border-white/20 rounded-3xl p-8 text-center mx-4">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-white font-black text-2xl mb-1">{winner} Wins!</h2>
            <p className="text-white/50 text-sm mb-4">UNO Champion!</p>
            {coinsEarned > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-yellow-400 text-xs font-black bg-yellow-500/10 border border-yellow-500/20 rounded-full py-1.5 px-3 mb-6 animate-pulse">
                🪙 +{coinsEarned.toLocaleString()} COINS EARNED!
              </div>
            )}
            <button onClick={initGame} className="w-full py-3 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-2xl text-white font-black">Play Again</button>
          </div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
