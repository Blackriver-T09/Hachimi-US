import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Menu, 
  Search, 
  Grid, 
  Heart,
  Settings,
  ExternalLink,
  ChevronLeft,
  Video as VideoIcon,
  Image as ImageIcon
} from "lucide-react"
import { Input } from "@/components/ui/input"

interface Video {
  id: number
  title: string
  source_url: string
  created_at: string
}

const Player = () => {
  const [videos, setVideos] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [viewMode, setViewMode] = useState<'browse' | 'playing'>('browse')
  const [bgMode, setBgMode] = useState<'blur' | 'video'>('blur')
  
  const [showEntranceAnimation, setShowEntranceAnimation] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number>(0)
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  
  // Refs for the new constellation layer
  const starsRef = useRef<(SVGCircleElement | null)[]>([])
  const linesRef = useRef<(SVGPathElement | null)[]>([])

  const navigate = useNavigate()

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/api/videos")
        if (response.data.success) {
          setVideos(response.data.data)
        }
      } catch (err) {
        console.error("Failed to fetch videos:", err)
      }
    }
    fetchVideos()
  }, [])

  useEffect(() => {
    if (currentVideo && audioRef.current) {
      audioRef.current.src = `http://127.0.0.1:5000/static/music/${currentVideo.id}.mp3`
      if (bgMode === 'video' && videoRef.current) {
        videoRef.current.src = `http://127.0.0.1:5000/static/videos/${currentVideo.id}.mp4`
      }
      
      if (isPlaying) {
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(e => console.error("Playback failed:", e))
        }
        if (bgMode === 'video' && videoRef.current) {
          videoRef.current.play().catch(e => console.error("Video play failed:", e))
        }
      }
    }
  }, [currentVideo])

  useEffect(() => {
    if (bgMode === 'video' && currentVideo && videoRef.current && audioRef.current) {
      videoRef.current.src = `http://127.0.0.1:5000/static/videos/${currentVideo.id}.mp4`
      videoRef.current.currentTime = audioRef.current.currentTime
      if (isPlaying) {
        videoRef.current.play().catch(e => console.error("Video play failed:", e))
      }
    }
  }, [bgMode])

  useEffect(() => {
    if (viewMode === 'playing') {
      setShowEntranceAnimation(true)
      const timer = setTimeout(() => {
        setShowEntranceAnimation(false)
      }, 2000)
      
      setupAudioAnalyzer()
      
      return () => {
        clearTimeout(timer)
      }
    }
  }, [viewMode])

  const setupAudioAnalyzer = () => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      // Only create source if it hasn't been created
      if (!sourceRef.current) {
        const source = audioCtx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      
      updateWaveform();
    } catch (e) {
      console.error("Audio context setup failed:", e);
    }
  }

  const updateWaveform = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let lastTime = performance.now();
    let bassSmoothed = 0;
    
    const draw = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      const dt = time - lastTime;
      lastTime = time;
      
      if (analyserRef.current) {
        // Keep animating even when paused, but slowly fade out or just idle
        const isPaused = audioRef.current?.paused;
        
        if (!isPaused) {
          analyserRef.current.getByteFrequencyData(dataArray);
        } else {
          // Slowly decay the values when paused so it doesn't just instantly snap to zero
          for (let i = 0; i < dataArray.length; i++) {
            dataArray[i] = Math.max(0, dataArray[i] - dt * 0.5);
          }
        }
        
        // Calculate average bass for pulsing effect (first 5 bins)
        let bassSum = 0;
        for (let i = 0; i < 5; i++) {
          bassSum += dataArray[i];
        }
        const bassAvg = bassSum / 5;
        
        // Smooth bass for less jittery pulsing
        bassSmoothed = bassSmoothed + (bassAvg - bassSmoothed) * 0.15;
        
        // Add subtle scale pulse based on bass
        const containerScale = 1 + (bassSmoothed / 255) * 0.05;
        const innerContainer = document.getElementById('waveform-container');
        if (innerContainer) {
          innerContainer.style.transform = `scale(${containerScale})`;
        }
        
        // Arrays to hold coordinates for the constellation lines
        const starCoords: { x: number, y: number, active: boolean, color: string }[] = [];
        const radius = 180; // Base radius matching renderWaveform
        
        for (let i = 0; i < 64; i++) {
          
          // Create an irregular but continuous pattern:
          // We pick a frequency bin based on 'i'. To make the whole circle active,
          // we use a sine wave to map 'i' (0-63) to frequency bins (0-40).
          // This creates a wave that goes low-mid-high-mid-low around the circle,
          // combined with a bit of pseudo-randomness for irregularity.
          
          const normalizedI = i / 63; // 0 to 1
          
          // base shape: a distorted sine wave so it hits low/mid frequencies multiple times around the circle
          const baseShape = Math.abs(Math.sin(normalizedI * Math.PI * 3 + time * 0.001));
          
          // Map to frequency bins 0 to 40 (where most musical energy is)
          // Add some irregular mapping based on index so adjacent bars aren't exactly the same
          let freqIndex = Math.floor(baseShape * 30 + (i % 3) * 5);
          
          // Ensure freqIndex is within bounds
          freqIndex = Math.max(0, Math.min(60, freqIndex));
          
          const value = dataArray[freqIndex] || 0;
          
          // Boost factors to ensure all sides have good height
          const boost = 1 + (freqIndex / 40) * 0.5;
          const heightOffset = Math.pow((value / 255), 1.2) * 80 * boost; // Max 80px added height
          
          // Irregular idle pulse so the circle always feels "alive" even when quiet
          const idlePulse = isPaused ? 0 : (Math.sin(time / 400 + i * 0.5) * 3 + 3);
          const totalHeight = 10 + heightOffset + idlePulse; // Base 10px height
          
          const bar = barsRef.current[i];
          
          // Colors based on height and position for a varied look
          const intensity = Math.min(1, totalHeight/90);
          const posColorShift = Math.sin(normalizedI * Math.PI * 2) * 0.5 + 0.5; // 0 to 1 based on position
          
          // Neon cyan/purple/pink irregular gradient
          const r = Math.floor(168 + (255 - 168) * posColorShift * intensity);
          const g = Math.floor(85 + (200 - 85) * (1 - posColorShift) * intensity);
          const b = Math.floor(247 + (255 - 247) * intensity);
          
          const starColor = `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.6})`;
          const shadowColor = `rgba(${r}, ${g}, ${b}, ${0.5 + intensity * 0.5})`;
          const boxShadow = `0 0 ${10 + intensity * 15}px ${shadowColor}`;
          const bgColor = `rgb(${255 - intensity * 30}, ${255 - intensity * 10}, ${255})`;
          
          if (bar) {
            bar.style.height = `${totalHeight}px`;
            bar.style.boxShadow = boxShadow;
            bar.style.backgroundColor = bgColor;
          }

          // Calculate constellation star position
          // To break the "circle" feeling, we want extreme spikes and valleys.
          // Base offset is smaller so quiet parts stay close to the bars
          const baseOffset = 15; 
          
          // Dynamic offset uses an exponential curve so peaks shoot out drastically 
          // while valleys stay low.
          const dynamicOffset = Math.pow(intensity, 3) * 150; 
          
          // Some random permanent spikes based on index so the baseline shape isn't a circle
          const structuralSpike = (i % 7 === 0) ? Math.pow(intensity, 1.5) * 60 : 0;
          const structuralDip = (i % 5 === 0) ? -20 * (1 - intensity) : 0;
          
          const floatingOffset = baseOffset + dynamicOffset + structuralSpike + structuralDip;
          const starDist = radius + totalHeight + floatingOffset;
          
          // Angle matches the bar's angle calculation in renderWaveform
          // Add slight angle jitter to break the perfect radial alignment
          const angleJitter = (Math.sin(i * 13) * 0.05) * intensity;
          const angle = (i / 64) * Math.PI * 2 - Math.PI / 2 + angleJitter;
          const sx = 200 + Math.cos(angle) * starDist; // 200 is the center of the 400x400 SVG
          const sy = 200 + Math.sin(angle) * starDist;
          
          // Only show active stars if they cross a certain height threshold to make it look like they "break free"
          const isActive = totalHeight > 30 && !isPaused;
          
          starCoords.push({ x: sx, y: sy, active: isActive, color: starColor });
          
          const starEl = starsRef.current[i];
          if (starEl) {
            // Smoothly move stars to target position
            const currentCx = parseFloat(starEl.getAttribute('cx') || String(sx));
            const currentCy = parseFloat(starEl.getAttribute('cy') || String(sy));
            
            // Lerp for smooth star movement
            const newCx = currentCx + (sx - currentCx) * 0.2;
            const newCy = currentCy + (sy - currentCy) * 0.2;
            
            starEl.setAttribute('cx', String(newCx));
            starEl.setAttribute('cy', String(newCy));
            
            // Fade opacity based on activity
            const currentOpacity = parseFloat(starEl.getAttribute('opacity') || '0');
            const targetOpacity = isActive ? (0.4 + intensity * 0.6) : 0.1;
            const newOpacity = currentOpacity + (targetOpacity - currentOpacity) * 0.1;
            
            starEl.setAttribute('opacity', String(newOpacity));
            starEl.setAttribute('fill', starColor);
            starEl.setAttribute('filter', `drop-shadow(0 0 ${5 + intensity*10}px ${starColor})`);
            
            // Update stored coords to actual rendered coords for line drawing
            starCoords[i].x = newCx;
            starCoords[i].y = newCy;
          }
        }
        
        // Draw constellation lines connecting active stars
        // We'll use 4 paths to group connections
        const pathData = ['', '', '', ''];
        
        for (let i = 0; i < 64; i++) {
          const curr = starCoords[i];
          if (!curr.active) continue;
          
          let connectionsCount = 0;
          
          // Connect to the closest active stars, ignoring exact index order
          // This breaks the ring and forms jagged constellations
          for (let j = 1; j <= 8; j++) {
            const nextIdx = (i + j) % 64;
            const next = starCoords[nextIdx];
            
            if (next.active && connectionsCount < 2) {
              // Calculate distance to ensure we only connect close nodes (prevents long crossing lines)
              const dx = curr.x - next.x;
              const dy = curr.y - next.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              
              // Only connect if distance is relatively small, but larger than adjacent
              if (dist < 150) {
                // Distribute paths randomly among the 4 line elements for varied opacity/colors
                const pathIdx = (i + j) % 4;
                pathData[pathIdx] += `M ${curr.x} ${curr.y} L ${next.x} ${next.y} `;
                connectionsCount++;
              }
            }
          }
        }
        
        for (let p = 0; p < 4; p++) {
          const lineEl = linesRef.current[p];
          if (lineEl) {
             lineEl.setAttribute('d', pathData[p]);
             // Dynamic opacity for the lines based on bass, boosted so they are brighter
             const baseOpacity = [0.4, 0.6, 0.8, 0.5][p];
             lineEl.setAttribute('opacity', String(baseOpacity + (bassSmoothed/255) * 0.5));
          }
        }
      }
    };
    
    draw(performance.now());
  }

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [])

  const togglePlay = async () => {
    if (!audioRef.current || !currentVideo) return
    
    try {
      // Ensure audio context is resumed on user interaction
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      if (isPlaying) {
        audioRef.current.pause()
        if (videoRef.current) videoRef.current.pause()
        setIsPlaying(false)
      } else {
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true)
            if (videoRef.current) videoRef.current.play().catch(e => console.error(e))
          }).catch(e => {
            console.error("Playback failed:", e)
            setIsPlaying(false)
          })
        }
      }
    } catch (e) {
      console.error("Toggle play error:", e)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime)
      setDuration(audioRef.current.duration || 0)
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00"
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setProgress(newTime)
      if (videoRef.current) {
        videoRef.current.currentTime = newTime
      }
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    if (videos.length === 0 || !currentVideo) return
    
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    if (currentIndex < videos.length - 1) {
      setCurrentVideo(videos[currentIndex + 1])
      setIsPlaying(true)
    }
  }

  const playNext = () => {
    if (!currentVideo || videos.length === 0) return
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const nextIndex = (currentIndex + 1) % videos.length
    setCurrentVideo(videos[nextIndex])
    setIsPlaying(true)
  }

  const playPrev = () => {
    if (!currentVideo || videos.length === 0) return
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length
    setCurrentVideo(videos[prevIndex])
    setIsPlaying(true)
  }

  // Generate waveform bars using real audio data if available
  const renderWaveform = () => {
    const bars = 64;
    // Align radius to be the same as the entrance ring (90px mapped to 400x400 viewbox -> which was 180px in 400x400 container)
    const radius = 180;
    const items = [];
    
    // reset bars array
    barsRef.current = new Array(bars).fill(null);
    
    for (let i = 0; i < bars; i++) {
      // Rotate starting angle so 0 is top
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      // Calculate rotation for the bar itself (point outward from center)
      const rotation = angle * (180 / Math.PI) + 90;
      
      const baseHeight = 10;
      
      items.push(
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="absolute w-1.5 bg-white rounded-full origin-bottom"
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
            height: `${baseHeight}px`,
            transitionProperty: 'height, box-shadow',
            transitionDuration: '75ms',
          }}
        />
      );
    }
    
    return items;
  }

  return (
    <div className="flex h-screen bg-[#1c1d25] text-zinc-300 font-sans overflow-hidden">
      
      <style>
        {`
          @keyframes drawRingFromTop {
            0% { 
              stroke-dasharray: 0 1131; 
              stroke-dashoffset: 0;
            }
            100% { 
              stroke-dasharray: 1131 1131; 
              stroke-dashoffset: 0;
            }
          }
          @keyframes expandRing {
            0% { 
              transform: scale(1); 
              opacity: 1;
              filter: drop-shadow(0 0 30px #a855f7);
            }
            100% { 
              transform: scale(8); 
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
          }
          @keyframes fadeInContent {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
          }
        `}
      </style>

      {/* Main Container - Absolute Positioning for Fullscreen Player */}
      <div className={`absolute inset-0 z-50 flex flex-col bg-black transition-transform duration-500 ease-in-out ${viewMode === 'playing' ? 'translate-y-0 opacity-100 visible' : 'translate-y-full opacity-0 invisible'}`}>
        
        {/* Background Layer */}
        <div className="absolute inset-0 overflow-hidden">
          {currentVideo && (
            bgMode === 'blur' ? (
              <>
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 scale-110 blur-xl transition-all duration-1000"
                  style={{ backgroundImage: `url(http://127.0.0.1:5000/static/figures/${currentVideo.id}.jpg)` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
              </>
            ) : (
              <video 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-90"
                muted
                playsInline
                loop={false}
              />
            )
          )}
        </div>

        {/* Content Layer */}
        <div className="relative z-10 flex flex-col h-full p-8">
          {/* Top Bar */}
          <div className="flex justify-between items-center w-full">
            <button 
              onClick={() => {
                setViewMode('browse')
                setShowEntranceAnimation(false)
              }}
              className="text-white/70 hover:text-white flex items-center gap-2 transition px-4 py-2 hover:bg-white/10 rounded-full"
            >
              <ChevronLeft size={20} /> Back
            </button>

            <div className="flex items-center gap-4">
              {/* Mode Toggle */}
              <div className="bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10 flex items-center shadow-lg">
                <button 
                  onClick={() => setBgMode('blur')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition ${bgMode === 'blur' ? 'bg-purple-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  <ImageIcon size={14} /> Blur & Wave
                </button>
                <button 
                  onClick={() => setBgMode('video')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition ${bgMode === 'video' ? 'bg-purple-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  <VideoIcon size={14} /> Video
                </button>
              </div>

              {currentVideo && (
                <a 
                  href={currentVideo.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white flex items-center gap-2 transition bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 hover:bg-white/20 shadow-lg"
                >
                  <ExternalLink size={16} /> Bilibili Source
                </a>
              )}
            </div>
          </div>

          {/* Center Area: Waveform / Info */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            {bgMode === 'blur' && (
              <div 
                className="relative w-[400px] h-[400px] flex items-center justify-center pointer-events-auto"
                style={showEntranceAnimation ? {
                  opacity: 0,
                  animationName: 'fadeInContent',
                  animationDuration: '0.5s',
                  animationDelay: '1.5s',
                  animationFillMode: 'forwards'
                } : {}}
              >
                {/* Outer Ring */}
                <div className="absolute inset-4 border border-white/20 rounded-full" />
                
                {/* Constellation SVG Layer */}
                <svg 
                  className="absolute inset-[-200px] w-[800px] h-[800px] pointer-events-none z-10 overflow-visible" 
                  viewBox="-200 -200 800 800"
                >
                  {/* Constellation Lines */}
                  {[0, 1, 2, 3].map(i => (
                    <path 
                      key={`line-${i}`}
                      ref={(el) => { linesRef.current[i] = el; }}
                      fill="none"
                      stroke="#e9d5ff"
                      strokeWidth={i === 2 ? "1.5" : "0.5"}
                      style={{ transition: 'opacity 0.1s' }}
                    />
                  ))}
                  
                  {/* Constellation Stars */}
                  {Array.from({ length: 64 }).map((_, i) => (
                    <circle
                      key={`star-${i}`}
                      ref={(el) => { starsRef.current[i] = el; }}
                      cx="200"
                      cy="200"
                      r={i % 5 === 0 ? "2.5" : "1.5"}
                      fill="transparent"
                      opacity="0"
                      style={{ transition: 'fill 0.1s' }}
                    />
                  ))}
                </svg>

                {/* Waveform */}
                {renderWaveform()}
                
                {/* Inner Cover/Info */}
                <div 
                  id="waveform-container"
                  className="absolute inset-8 rounded-full overflow-hidden shadow-2xl border-2 border-white/10 bg-black/40 backdrop-blur-sm transition-transform duration-75"
                >
                  {currentVideo && (
                    <>
                      <img 
                        src={`http://127.0.0.1:5000/static/figures/${currentVideo.id}.jpg`} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover opacity-30" 
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                        <h1 className="text-2xl font-bold text-white mb-2 line-clamp-3 leading-snug drop-shadow-md">
                          {currentVideo.title}
                        </h1>
                        <p className="text-lg text-purple-300 font-mono mt-2 drop-shadow-md">
                          {formatTime(progress)} / {formatTime(duration)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floating Progress Bar */}
          <div 
            className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl px-8"
            style={showEntranceAnimation ? {
              opacity: 0,
              animationName: 'fadeInContent',
              animationDuration: '0.5s',
              animationDelay: '1.5s',
              animationFillMode: 'forwards'
            } : {}}
          >
            <div className="flex items-center gap-4 w-full bg-white/10 backdrop-blur-xl rounded-full px-6 py-3 border border-white/20 shadow-2xl">
              <span className="text-sm font-mono text-white/70 w-12 text-right">{formatTime(progress)}</span>
              <div className="flex-1 h-2 relative group cursor-pointer flex items-center">
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  value={progress} 
                  onChange={handleProgressChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden transition-all group-hover:h-2">
                  <div 
                    className="h-full bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  ></div>
                </div>
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none"
                  style={{ left: `calc(${(progress / (duration || 1)) * 100}% - 8px)` }}
                ></div>
              </div>
              <span className="text-sm font-mono text-white/70 w-12">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Floating Glass Control Buttons */}
          <div 
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6"
            style={showEntranceAnimation ? {
              opacity: 0,
              animationName: 'fadeInContent',
              animationDuration: '0.5s',
              animationDelay: '1.5s',
              animationFillMode: 'forwards'
            } : {}}
          >
            <button 
              onClick={playPrev} 
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all shadow-2xl"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-18 h-18 p-5 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white flex items-center justify-center hover:bg-white/25 hover:scale-105 transition-all shadow-2xl"
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>
            <button 
              onClick={playNext} 
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all shadow-2xl"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* Entrance Animation Overlay */}
        {showEntranceAnimation && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black">
            <svg 
              className="w-[400px] h-[400px]" 
              viewBox="0 0 400 400"
              style={{
                animationName: 'expandRing',
                animationDuration: '0.6s',
                animationDelay: '1.2s',
                animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                animationFillMode: 'forwards'
              }}
            >
              <circle 
                cx="200" 
                cy="200" 
                r="180" 
                fill="none" 
                stroke="#a855f7" 
                strokeWidth="3" 
                strokeLinecap="round"
                style={{
                  transformOrigin: 'center',
                  transform: 'rotate(-90deg)',
                  animationName: 'drawRingFromTop',
                  animationDuration: '1.2s',
                  animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  animationFillMode: 'forwards',
                  filter: 'drop-shadow(0 0 20px #a855f7)'
                }}
              />
            </svg>
          </div>
        )}
      </div>

      {/* ---------------- BROWSE VIEW LAYOUT ---------------- */}
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#1f2129] flex flex-col pt-8 shrink-0 relative z-20">
        <div className="px-8 pb-8 flex items-center gap-3 font-bold text-xl text-white cursor-pointer" onClick={() => setViewMode('browse')}>
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            H
          </div>
          Hachimi
        </div>

        <nav className="space-y-6 px-4 flex-1">
          <div className="space-y-1">
            <button 
              onClick={() => setViewMode('browse')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition ${viewMode === 'browse' ? 'bg-zinc-800/40 text-white border-l-2 border-purple-500' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${viewMode === 'browse' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5'}`}>
                <Grid size={16} />
              </div>
              <span className="font-medium">Browse</span>
            </button>
            <button 
              onClick={() => {
                if (currentVideo) setViewMode('playing')
              }}
              disabled={!currentVideo}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition ${!currentVideo ? 'opacity-50 cursor-not-allowed' : ''} ${viewMode === 'playing' ? 'bg-zinc-800/40 text-white border-l-2 border-purple-500' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${viewMode === 'playing' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5'}`}>
                <Play size={16} />
              </div>
              <span className="font-medium">Now Playing</span>
            </button>
            <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition mt-8">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Menu size={16} /></div>
              <span className="font-medium">Playlists</span>
            </button>
            <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Heart size={16} /></div>
              <span className="font-medium">Favorites</span>
            </button>
          </div>

          <div className="px-4 space-y-4 pt-4">
            {['Favorite Track', 'Top Track', 'Playlist', 'Albums', 'Artists'].map(item => (
              <a key={item} href="#" className="block text-sm font-medium text-zinc-500 hover:text-zinc-300 transition">{item}</a>
            ))}
          </div>
        </nav>

        {/* Admin Link at Bottom */}
        <div className="p-4 mt-auto mb-24">
           <button 
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:bg-zinc-800/50 hover:text-white transition border border-zinc-800"
          >
            <Settings size={16} />
            <span className="text-sm font-medium">Admin Panel</span>
          </button>
        </div>
      </aside>

      {/* Browse Content Area */}
      <main className="flex-1 flex flex-col h-full relative z-10 bg-[#1c1d25] pb-28">
        
        {/* Header */}
        <header className="h-24 px-10 flex items-center shrink-0 w-full">
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <Input 
              type="text" 
              placeholder="Search" 
              className="w-full pl-12 h-12 bg-white/5 border border-white/10 rounded-full text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:bg-white/10 transition-all shadow-sm"
            />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar text-left w-full max-w-7xl mx-auto">
          <div className="mb-12 text-left">
            <div className="flex justify-between items-end mb-8 text-left">
              <h2 className="text-3xl font-bold text-white tracking-tight">Recent Scrapes</h2>
              <button className="text-sm font-medium text-purple-400 hover:text-purple-300 transition">See all</button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 text-left">
              {videos.map(video => (
                <div 
                  key={video.id}
                  onClick={() => {
                    setCurrentVideo(video)
                    setIsPlaying(true)
                    setViewMode('playing')
                  }}
                  className={`bg-[#252731] rounded-2xl p-4 cursor-pointer transition-all duration-300 group hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 border text-left ${
                    currentVideo?.id === video.id ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="aspect-square rounded-xl overflow-hidden mb-4 relative bg-black/50">
                    <img 
                      src={`http://127.0.0.1:5000/static/figures/${video.id}.jpg`} 
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/shapes/svg?seed=${video.id}`
                      }}
                    />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 backdrop-blur-[2px] ${currentVideo?.id === video.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xl shadow-purple-600/50 hover:bg-purple-500 hover:scale-105 transition-all">
                        {currentVideo?.id === video.id && isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                      </div>
                    </div>
                  </div>
                  <h3 className="font-bold text-zinc-100 truncate text-base mb-1.5" title={video.title}>
                    {video.title}
                  </h3>
                  <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                    <p className="truncate pr-2">Bilibili</p>
                    <span className="shrink-0 bg-black/30 px-2 py-1 rounded text-zinc-300">{formatTime(currentVideo?.id === video.id ? duration : 0)}</span>
                  </div>
                </div>
              ))}
              
              {videos.length === 0 && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-500 bg-[#252731] rounded-2xl border border-zinc-800 border-dashed">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search size={24} className="text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-400">No music found</p>
                  <button onClick={() => navigate("/admin")} className="text-purple-400 hover:text-purple-300 mt-2 text-sm font-medium px-4 py-2 bg-purple-500/10 rounded-full hover:bg-purple-500/20 transition">Go to Admin panel to add some</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Global Hidden Audio element for browse view */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={handleEnded} 
        onLoadedMetadata={handleTimeUpdate}
        className="hidden"
        crossOrigin="anonymous"
      />

      {/* Bottom Mini Player Bar (Visible in browse view when something is selected) */}
      <div className={`fixed bottom-0 left-0 right-0 h-24 bg-[#1f2129]/95 backdrop-blur-md border-t border-white/5 flex items-center px-6 z-[60] transition-transform duration-300 ${viewMode === 'browse' && currentVideo ? 'translate-y-0' : 'translate-y-full'}`}>
        
        {/* Left: Track Info */}
        <div className="flex items-center gap-4 w-[320px] shrink-0">
          {currentVideo && (
            <>
              <div 
                className="w-14 h-14 rounded-lg bg-zinc-800 overflow-hidden cursor-pointer relative group shrink-0 shadow-md"
                onClick={() => setViewMode('playing')}
              >
                <img 
                  src={`http://127.0.0.1:5000/static/figures/${currentVideo.id}.jpg`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                  alt="" 
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[1px]">
                  <ExternalLink size={16} className="text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <h4 
                  className="font-bold text-zinc-100 truncate text-[15px] tracking-tight cursor-pointer hover:text-purple-400 transition hover:underline" 
                  onClick={() => setViewMode('playing')}
                >
                  {currentVideo.title}
                </h4>
                <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">Bilibili Source</p>
              </div>
            </>
          )}
        </div>

        {/* Center: Controls & Mini Progress */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-6 mb-2">
            <button onClick={playPrev} className="text-zinc-400 hover:text-white transition">
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={playNext} className="text-zinc-400 hover:text-white transition">
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11px] font-mono text-zinc-500 w-8 text-right">{formatTime(progress)}</span>
            <div className="flex-1 h-1 relative group cursor-pointer flex items-center">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={progress} 
                onChange={handleProgressChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden transition-all group-hover:h-1.5">
                <div 
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 w-8">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-[320px] shrink-0 flex justify-end items-center gap-4">
           {currentVideo && (
            <a 
              href={currentVideo.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition border border-white/5"
              title="Open Source"
            >
              <ExternalLink size={14} />
            </a>
           )}
        </div>
      </div>

    </div>
  )
}

export default Player
