import React, { useState, useCallback, Suspense } from 'react';
import { HeTuScene } from './components/HeTuScene';
import { LoShuScene } from './components/LoShuScene';
import { AnimationState, ViewMode, LoShuMorphState, LoShuLayerState } from './types';

const LoadingScreen = () => (
  <div className="flex items-center justify-center w-full h-full text-cyan-400 text-sm tracking-widest uppercase animate-pulse">
    系统初始化中...
  </div>
);

const App: React.FC = () => {
  // --- GLOBAL STATE ---
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HETU);

  // --- HE TU STATE ---
  const [alignTrigger, setAlignTrigger] = useState(0);
  const [animState, setAnimState] = useState<AnimationState>(AnimationState.STATIC);
  const [autoRotate, setAutoRotate] = useState(false);
  const [lastMode, setLastMode] = useState<'GALAXY' | 'HELIX'>('GALAXY');

  // --- LO SHU STATE ---
  const [lsMorph, setLsMorph] = useState<LoShuMorphState>(LoShuMorphState.PLANE);
  const [lsRunning, setLsRunning] = useState(false); // Now "Flying Star" (Energy Flow)
  const [lsSphereRotating, setLsSphereRotating] = useState(false); // New "Run" (Sphere Rotation)
  
  // DEFAULT STATE: Dots ONLY (User Request)
  const [lsLayers, setLsLayers] = useState<LoShuLayerState>({
    dots: true,       // Raw coding layer (Visible by default)
    numbers: false,   // Interpretation layer (Hidden)
    trigrams: false,  // Semantic layer (Hidden)
    directions: false,// Context layer (Hidden)
    lines: false      // Energy layer (Hidden by default)
  });

  // --- HE TU HANDLERS ---
  const handleAlign = useCallback(() => {
    setAlignTrigger(prev => prev + 1);
    setAutoRotate(false); 
  }, []);

  const handleToggleAutoRotate = () => {
    setAutoRotate(prev => !prev);
  };

  const handleGalaxyClick = () => {
    if (
      animState === AnimationState.HELIX_RUNNING || 
      animState === AnimationState.HELIX_PAUSED || 
      animState === AnimationState.HELIX_MORPHING
    ) {
      setLastMode('GALAXY');
      setAnimState(AnimationState.MORPHING);
      setTimeout(() => {
        setAnimState(curr => curr === AnimationState.MORPHING ? AnimationState.RUNNING : curr);
      }, 1000);
      return;
    }
    setLastMode('GALAXY');
    if (animState === AnimationState.STATIC || animState === AnimationState.RETURNING) {
      setAnimState(AnimationState.MORPHING);
      setTimeout(() => {
        setAnimState(curr => curr === AnimationState.MORPHING ? AnimationState.RUNNING : curr);
      }, 1000);
    } else if (animState === AnimationState.RUNNING) {
      setAnimState(AnimationState.PAUSED);
    } else if (animState === AnimationState.PAUSED) {
      setAnimState(AnimationState.RUNNING);
    }
  };

  const handleHelixClick = () => {
    if (
      animState === AnimationState.RUNNING || 
      animState === AnimationState.PAUSED || 
      animState === AnimationState.MORPHING
    ) {
      setLastMode('HELIX');
      setAnimState(AnimationState.HELIX_MORPHING);
      setTimeout(() => {
        setAnimState(curr => curr === AnimationState.HELIX_MORPHING ? AnimationState.HELIX_RUNNING : curr);
      }, 1000);
      return;
    }
    setLastMode('HELIX');
    if (animState === AnimationState.STATIC || animState === AnimationState.RETURNING) {
      setAnimState(AnimationState.HELIX_MORPHING);
      setTimeout(() => {
        setAnimState(curr => curr === AnimationState.HELIX_MORPHING ? AnimationState.HELIX_RUNNING : curr);
      }, 1000);
    } else if (animState === AnimationState.HELIX_RUNNING) {
      setAnimState(AnimationState.HELIX_PAUSED);
    } else if (animState === AnimationState.HELIX_PAUSED) {
      setAnimState(AnimationState.HELIX_RUNNING);
    }
  };

  const handleReset = () => {
    if (animState !== AnimationState.STATIC) {
      if (
        animState === AnimationState.HELIX_RUNNING || 
        animState === AnimationState.HELIX_MORPHING || 
        animState === AnimationState.HELIX_PAUSED
      ) {
        setLastMode('HELIX');
      } else {
        setLastMode('GALAXY');
      }
      setAnimState(AnimationState.RETURNING);
      setTimeout(() => {
        setAnimState(curr => curr === AnimationState.RETURNING ? AnimationState.STATIC : curr);
      }, 1000);
    }
  };

  const getGalaxyButtonText = () => {
    if (animState === AnimationState.RETURNING && lastMode === 'GALAXY') return '归位中...';
    switch (animState) {
      case AnimationState.MORPHING: return '演化中...';
      case AnimationState.RUNNING: return '暂停阴阳';
      case AnimationState.PAUSED: return '继续阴阳';
      case AnimationState.HELIX_MORPHING:
      case AnimationState.HELIX_RUNNING:
      case AnimationState.HELIX_PAUSED:
        return '阴阳';
      default: return '阴阳';
    }
  };

  const getHelixButtonText = () => {
    if (animState === AnimationState.RETURNING && lastMode === 'HELIX') return '归位中...';
    switch (animState) {
      case AnimationState.HELIX_MORPHING: return '演化中...';
      case AnimationState.HELIX_RUNNING: return '暂停双螺旋';
      case AnimationState.HELIX_PAUSED: return '继续双螺旋';
      case AnimationState.MORPHING:
      case AnimationState.RUNNING:
      case AnimationState.PAUSED:
        return '双螺旋';
      default: return '双螺旋';
    }
  };

  // --- LO SHU HANDLERS ---
  const toggleLayer = (key: keyof LoShuLayerState) => {
    setLsLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLoShuReset = () => {
    setLsMorph(LoShuMorphState.PLANE);
    setLsRunning(false);
    setLsSphereRotating(false);
    // Reset to Dots only
    setLsLayers({ dots: true, numbers: false, trigrams: false, directions: false, lines: false });
  };

  return (
    <div className="relative w-full h-full font-sans text-cyan-50 overflow-hidden select-none">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0 transition-opacity duration-1000">
        <Suspense fallback={<LoadingScreen />}>
          {viewMode === ViewMode.HETU ? (
             <HeTuScene alignTrigger={alignTrigger} animState={animState} autoRotate={autoRotate} />
          ) : (
             <LoShuScene 
               morphState={lsMorph} 
               layerState={lsLayers} 
               isRunning={lsRunning} 
               isSphereRotating={lsSphereRotating}
             />
          )}
        </Suspense>
      </div>

      {/* Main UI Container */}
      <div className="absolute inset-0 z-10 pointer-events-none p-6 md:p-8 flex flex-col justify-between">
        
        {/* Header & Navigation */}
        <header className="flex justify-between items-start opacity-90 pointer-events-auto">
          <div>
            <div className="flex gap-6 mb-2">
              <button 
                 onClick={() => setViewMode(ViewMode.HETU)}
                 className={`text-2xl md:text-3xl font-light tracking-[0.2em] uppercase transition-all duration-300
                   ${viewMode === ViewMode.HETU 
                     ? 'text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] border-b border-cyan-400' 
                     : 'text-cyan-700 hover:text-cyan-400'}`}
              >
                河 图
              </button>
              <button 
                 onClick={() => setViewMode(ViewMode.LOSHU)}
                 className={`text-2xl md:text-3xl font-light tracking-[0.2em] uppercase transition-all duration-300
                   ${viewMode === ViewMode.LOSHU
                     ? 'text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] border-b border-cyan-400' 
                     : 'text-cyan-700 hover:text-cyan-400'}`}
              >
                洛 书
              </button>
            </div>
            <p className="text-[10px] md:text-xs text-cyan-400 tracking-widest mt-1 uppercase">
              {viewMode === ViewMode.HETU ? '立方生成系统' : '立体运行系统'}
            </p>
          </div>
        </header>

        {/* --- HE TU CONTROLS --- */}
        {viewMode === ViewMode.HETU && (
          <div className="flex justify-between items-end animate-fadeIn">
            <div className="hidden md:block text-[10px] text-cyan-300 tracking-widest leading-relaxed uppercase font-medium">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] rounded-full inline-block"></span>
                天面 (-Z)
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 bg-black border border-cyan-800 rounded-full inline-block"></span>
                 地面 (+Z)
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 border border-cyan-400 rounded-full inline-block"></span>
                 中枢 (0)
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pointer-events-auto">
               <button onClick={handleReset} disabled={animState === AnimationState.STATIC} className={`px-4 py-2 md:px-6 md:py-3 border border-cyan-500/30 rounded-sm transition-all duration-300 ${animState === AnimationState.STATIC ? 'opacity-30 cursor-not-allowed' : 'bg-cyan-950/30 hover:bg-red-900/40 text-cyan-200 hover:text-white'}`}>
                <span className="text-xs tracking-[0.15em] uppercase">重置</span>
              </button>
              <button onClick={handleGalaxyClick} className={`group flex items-center gap-3 px-4 py-2 md:px-6 md:py-3 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out shadow-[0_0_15px_rgba(6,182,212,0.1)] min-w-[100px] md:min-w-[140px] justify-center ${(animState === AnimationState.RUNNING || animState === AnimationState.PAUSED || animState === AnimationState.MORPHING) ? 'bg-cyan-800/60 text-white shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-200'}`}>
                <span className="text-xs tracking-[0.15em] uppercase group-hover:text-white transition-colors">{getGalaxyButtonText()}</span>
              </button>
               <button onClick={handleHelixClick} className={`group flex items-center gap-3 px-4 py-2 md:px-6 md:py-3 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out shadow-[0_0_15px_rgba(6,182,212,0.1)] min-w-[100px] md:min-w-[140px] justify-center ${(animState === AnimationState.HELIX_RUNNING || animState === AnimationState.HELIX_PAUSED || animState === AnimationState.HELIX_MORPHING) ? 'bg-cyan-800/60 text-white shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-200'}`}>
                <span className="text-xs tracking-[0.15em] uppercase group-hover:text-white transition-colors">{getHelixButtonText()}</span>
              </button>
              <button onClick={handleToggleAutoRotate} className={`group flex items-center justify-center w-10 h-10 md:w-12 md:h-12 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out shadow-[0_0_15px_rgba(6,182,212,0.1)] ${autoRotate ? 'bg-cyan-800/60 text-white' : 'bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 12c0-4.97 4.03-9 9-9c4.36 0 8.04 3.06 8.8 7.23M22 12c0 4.97-4.03 9-9 9c-4.36 0-8.04-3.06-8.8-7.23"/></svg>
              </button>
              <button onClick={handleAlign} className="group flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-cyan-950/30 hover:bg-cyan-900/40 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-70 group-hover:opacity-100 transition-opacity text-cyan-400 group-hover:text-cyan-200"><rect x="0.5" y="0.5" width="11" height="11" stroke="currentColor" /><circle cx="6" cy="6" r="2" fill="currentColor" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* --- LO SHU CONTROLS --- */}
        {viewMode === ViewMode.LOSHU && (
          <div className="flex flex-col md:flex-row justify-between items-end animate-fadeIn w-full">
             
             {/* Left: System Status - UPDATED */}
             <div className="hidden md:block text-[10px] text-cyan-300 tracking-widest leading-relaxed uppercase font-medium mb-4 md:mb-0">
               <p className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${lsRunning ? 'bg-amber-400 shadow-[0_0_5px_#fbbf24]' : 'bg-cyan-800'}`}></span>
                 {lsRunning ? '能量: 飞星传输中' : '能量: 待命'}
               </p>
               <p className="flex items-center gap-2 mt-1">
                 <span className={`w-2 h-2 rounded-full ${lsSphereRotating ? 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]' : 'bg-cyan-800'}`}></span>
                 {lsSphereRotating ? '动态: 立体运转中' : '动态: 静态锁定'}
               </p>
             </div>

             {/* Right: Controls Grid - REORDERED */}
             <div className="flex flex-wrap justify-end gap-2 md:gap-4 pointer-events-auto items-center w-full md:w-auto">
                
                {/* 1. Reset */}
                <button onClick={handleLoShuReset} className="px-4 py-2 border border-cyan-500/30 rounded-sm bg-cyan-950/30 hover:bg-red-900/40 text-cyan-200 hover:text-white transition-all order-last md:order-first">
                  <span className="text-xs tracking-[0.15em] uppercase">重置</span>
                </button>

                {/* Layer Toggles Group */}
                <div className="flex gap-4 bg-cyan-950/40 p-1 rounded border border-cyan-500/20 backdrop-blur-sm">
                  
                  {/* 2. Dots */}
                  <button onClick={() => toggleLayer('dots')} className={`px-3 py-2 text-xs uppercase rounded transition-colors ${lsLayers.dots ? 'bg-cyan-700 text-white shadow-sm' : 'text-cyan-500/70 hover:text-cyan-300'}`} title="原始编码层">
                      黑白子
                  </button>

                  {/* 3. Numbers */}
                  <button onClick={() => toggleLayer('numbers')} className={`px-3 py-2 text-xs uppercase rounded transition-colors ${lsLayers.numbers ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-cyan-500 hover:text-cyan-300'}`} title="运行解释层">
                      数字
                  </button>

                  {/* 4. Trigrams */}
                  <button onClick={() => toggleLayer('trigrams')} className={`px-3 py-2 text-xs uppercase rounded transition-colors ${lsLayers.trigrams ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-cyan-500 hover:text-cyan-300'}`} title="语义层">
                      八卦
                  </button>

                  {/* 5. Directions */}
                  <button onClick={() => toggleLayer('directions')} className={`px-3 py-2 text-xs uppercase rounded transition-colors ${lsLayers.directions ? 'bg-cyan-600 text-white shadow-sm' : 'text-cyan-500 hover:text-cyan-300'}`}>
                      方位
                  </button>

                   {/* 6. Lines */}
                   <button onClick={() => toggleLayer('lines')} className={`px-3 py-2 text-xs uppercase rounded transition-colors ${lsLayers.lines ? 'bg-cyan-600 text-white shadow-sm' : 'text-cyan-500 hover:text-cyan-300'}`}>
                      连线
                    </button>
                </div>

                {/* 7. Morph Button (Plane <-> Sphere) */}
                <button 
                  onClick={() => setLsMorph(prev => prev === LoShuMorphState.PLANE ? LoShuMorphState.SPHERE : LoShuMorphState.PLANE)}
                  className={`flex items-center gap-2 px-4 py-2 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out min-w-[100px] justify-center
                    ${lsMorph !== LoShuMorphState.PLANE
                      ? 'bg-cyan-800/80 text-white border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                      : 'bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-200'}`}
                >
                  <span className="text-xs tracking-[0.15em] uppercase">
                    {lsMorph === LoShuMorphState.PLANE ? '升维' : '降维'}
                  </span>
                </button>

                {/* 8. Flying Star (Energy Flow) */}
                 <button 
                  disabled={lsMorph === LoShuMorphState.PLANE}
                  onClick={() => setLsRunning(!lsRunning)}
                  className={`flex items-center gap-2 px-4 py-2 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out min-w-[100px] justify-center
                    ${lsMorph === LoShuMorphState.PLANE ? 'opacity-30 cursor-not-allowed' : ''}
                    ${lsRunning
                      ? 'bg-amber-800/60 text-white shadow-[0_0_20px_rgba(251,191,36,0.3)]' 
                      : 'bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-200'}`}
                >
                  <span className="text-xs tracking-[0.15em] uppercase">
                    {lsRunning ? '暂停飞星' : '飞星'}
                  </span>
                </button>
                
                {/* 9. Run (Sphere Rotation) */}
                 <button 
                  disabled={lsMorph === LoShuMorphState.PLANE}
                  onClick={() => setLsSphereRotating(!lsSphereRotating)}
                  className={`flex items-center gap-2 px-4 py-2 backdrop-blur-md border border-cyan-500/30 rounded-sm transition-all duration-500 ease-out min-w-[100px] justify-center
                    ${lsMorph === LoShuMorphState.PLANE ? 'opacity-30 cursor-not-allowed' : ''}
                    ${lsSphereRotating
                      ? 'bg-cyan-800/80 text-white border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                      : 'bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-200'}`}
                >
                  <span className="text-xs tracking-[0.15em] uppercase">
                     {lsSphereRotating ? '停止运行' : '运行'}
                  </span>
                </button>

             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;