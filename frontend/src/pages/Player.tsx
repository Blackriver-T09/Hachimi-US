import { useState, useEffect, useRef, useMemo } from "react"
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
  ExternalLink,
  ChevronLeft,
  Video as VideoIcon,
  Music,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ListPlus,
  GripVertical,
  X
} from "lucide-react"
import { Input } from "@/components/ui/input"

interface Video {
  id: number
  title: string
  source_url: string
  created_at: string
  likes: number
}

const Player = () => {
  const [videos, setVideos] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)
  const [videosError, setVideosError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  // Use refs for progress and duration to prevent re-renders
  const progressRef = useRef(0)
  const durationRef = useRef(0)
  const [viewMode, setViewMode] = useState<'browse' | 'playing' | 'favorites' | 'playlists'>('browse')
  const [bgMode, setBgMode] = useState<'blur' | 'video'>('blur')
  const [volume, setVolume] = useState(1) // 0 to 1
  const [isMuted, setIsMuted] = useState(false)
  const [playMode, setPlayMode] = useState<'loop' | 'loop-one' | 'shuffle'>('loop') // loop all, loop one, shuffle
  const [likedVideos, setLikedVideos] = useState<Set<number>>(() => {
    // Load liked videos from localStorage
    const saved = localStorage.getItem('likedVideos')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [playlist, setPlaylist] = useState<number[]>(() => {
    // Load playlist from localStorage (array of video IDs)
    const saved = localStorage.getItem('playlist')
    return saved ? JSON.parse(saved) : []
  })
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  
  // Session ID for online tracking - shared across all tabs in same browser
  const getOrCreateSessionId = () => {
    // Try to get existing session ID from localStorage
    let sessionId = localStorage.getItem('hachimi_session_id')
    if (!sessionId) {
      // Generate new session ID with browser fingerprint
      const browserFingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${navigator.language}`
      const hash = browserFingerprint.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
      }, 0)
      sessionId = `session_${Math.abs(hash)}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem('hachimi_session_id', sessionId)
    }
    return sessionId
  }
  const sessionIdRef = useRef<string>(getOrCreateSessionId())
  
  // DOM Refs for direct updates to bypass React re-renders
  const progressLineRef = useRef<HTMLDivElement>(null)
  const progressThumbRef = useRef<HTMLDivElement>(null)
  const currentTimeLabelRef = useRef<HTMLSpanElement>(null)
  const durationLabelRef = useRef<HTMLSpanElement>(null)
  const miniProgressLineRef = useRef<HTMLDivElement>(null)
  const miniCurrentTimeLabelRef = useRef<HTMLSpanElement>(null)
  const miniDurationLabelRef = useRef<HTMLSpanElement>(null)
  const waveformTimeLabelRef = useRef<HTMLParagraphElement>(null)
  
  const [showEntranceAnimation, setShowEntranceAnimation] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number>(0)
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const waveformContainerRef = useRef<HTMLDivElement>(null)
  
  // Canvas ref for constellation layer (replaces SVG for performance)
  const constellationCanvasRef = useRef<HTMLCanvasElement>(null)
  // Track viewMode in a ref so the rAF closure always sees the latest value
  const viewModeRef = useRef<'browse' | 'playing' | 'favorites' | 'playlists'>('browse')
  // Store star positions in memory instead of reading from DOM
  const starPositions = useRef<{x: number, y: number, opacity: number, r: number, g: number, b: number, alpha: number}[]>(
    Array.from({length: 64}, () => ({x: 0, y: 0, opacity: 0, r: 168, g: 85, b: 247, alpha: 0.5}))
  )

  // Keep viewModeRef in sync with viewMode state
  useEffect(() => {
    viewModeRef.current = viewMode
    // When leaving the playing view, stop the animation loop immediately
    if (viewMode !== 'playing' && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = 0
    }
  }, [viewMode])

  useEffect(() => {
    setIsLoadingVideos(true)
    const fetchVideos = async () => {
      try {
        const response = await axios.get("/api/videos")
        if (response.data.success) {
          // Only store metadata, don't preload any media files here
          const videoList = response.data.data
          setVideos(videoList)
          
          // Auto-play initial track if START_INDEX is configured
          try {
            const configResponse = await axios.get("/api/config")
            if (configResponse.data.success && configResponse.data.start_index !== null) {
              const startIndex = configResponse.data.start_index
              // Find video by ID (not array index)
              const initialVideo = videoList.find((v: Video) => v.id === startIndex)
              if (initialVideo) {
                setCurrentVideo(initialVideo)
                setIsPlaying(true)
                // Stay in browse view, don't switch to playing view
                
                // Try to auto-play immediately (may be blocked by browser)
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.play().catch(_err => {
                      console.log("Auto-play blocked by browser, waiting for user interaction")
                      // Browser blocked auto-play, will play when user interacts
                    })
                  }
                }, 100)
              }
            }
          } catch (configErr) {
            // Silently ignore config fetch errors
            console.log("No auto-play config found")
          }
        } else {
          setVideos([])
          setVideosError("Failed to load song list.")
        }
      } catch (err) {
        console.error("Failed to fetch videos:", err)
        setVideos([])
        setVideosError("Backend is unavailable. Please start the server on localhost:5000.")
      } finally {
        setIsLoadingVideos(false)
      }
    }
    fetchVideos()
    
    // Send heartbeat to track online users
    const sendHeartbeat = async () => {
      try {
        await axios.post('/api/heartbeat', {
          session_id: sessionIdRef.current
        })
      } catch (err) {
        // Silently fail - heartbeat is not critical
      }
    }
    
    // Send initial heartbeat
    sendHeartbeat()
    
    // Send heartbeat every 10 seconds
    // All tabs with same session ID will send heartbeats
    // User is considered online as long as ANY tab is sending heartbeats
    const heartbeatInterval = setInterval(sendHeartbeat, 10000)
    
    return () => {
      clearInterval(heartbeatInterval)
      // Don't send offline signal - let session timeout naturally
      // This way, if user has other tabs open, they stay online
    }
  }, [])

  useEffect(() => {
    if (currentVideo && audioRef.current) {
      // Stop and clear current source before switching
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      
      audioRef.current.src = `/static/music/${currentVideo.id}.mp3`
      // Apply current volume settings
      audioRef.current.volume = isMuted ? 0 : volume
      
      if (bgMode === 'video' && videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
        videoRef.current.src = `/static/videos/${currentVideo.id}.mp4`
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

  // Separate effect for volume control - only updates volume, doesn't reload track
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [isMuted, volume])

  useEffect(() => {
    if (bgMode === 'video' && currentVideo && videoRef.current && audioRef.current) {
      videoRef.current.src = `/static/videos/${currentVideo.id}.mp4`
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

  // Spacebar keyboard event for play/pause
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle spacebar when not typing in an input field
      if (e.code === 'Space' && e.target instanceof HTMLElement && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault() // Prevent page scroll
        
        if (currentVideo && audioRef.current) {
          if (isPlaying) {
            audioRef.current.pause()
            setIsPlaying(false)
          } else {
            audioRef.current.play().catch(err => {
              console.error('Playback failed:', err)
            })
            setIsPlaying(true)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentVideo, isPlaying])

  const setupAudioAnalyzer = () => {
    if (!audioRef.current) return;

    // Cancel any existing animation loop before starting a new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = 0
    }

    if (audioContextRef.current) {
      // Context already exists — just restart the draw loop
      updateWaveform()
      return
    }

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
    let frameCount = 0;
    
    const draw = (time: number) => {
      // Use viewModeRef (not the stale closure variable) to check current view
      if (viewModeRef.current !== 'playing' || !analyserRef.current) {
        animationFrameRef.current = 0
        return;
      }
      
      animationFrameRef.current = requestAnimationFrame(draw);
      
      // Optimization: skip all heavy calculations if we're not actually looking at the player view
      if (document.hidden) return;
      
      // Throttle to ~30fps to reduce CPU load
      frameCount++;
      if (frameCount % 2 !== 0) return;
      
      const innerContainer = waveformContainerRef.current;
      if (!innerContainer) return;
      
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
        // Use the ref directly — no getElementById needed
        if (waveformContainerRef.current) {
          waveformContainerRef.current.style.transform = `scale(${containerScale})`;
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
          
          // Simplified color calculations - cache common values
          const shadowBlur = 10 + intensity * 15;
          const boxShadow = `0 0 ${shadowBlur}px rgba(${r}, ${g}, ${b}, ${0.5 + intensity * 0.5})`;
          const bgColor = `rgb(${255 - intensity * 30}, ${255 - intensity * 10}, 255)`;
          
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
          // Store relative coordinates (centered at 0,0), will add canvas offset when drawing
          const sx = Math.cos(angle) * starDist;
          const sy = Math.sin(angle) * starDist;
          
          // Only show active stars if they cross a certain height threshold to make it look like they "break free"
          const isActive = totalHeight > 30 && !isPaused;
          
          starCoords.push({ x: sx, y: sy, active: isActive, color: `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.6})` });
          
          // Update star positions in memory (no DOM access)
          const star = starPositions.current[i];
          
          // Lerp for smooth star movement
          star.x = star.x + (sx - star.x) * 0.2;
          star.y = star.y + (sy - star.y) * 0.2;
          
          // Fade opacity based on activity
          const targetOpacity = isActive ? (0.4 + intensity * 0.6) : 0.1;
          star.opacity = star.opacity + (targetOpacity - star.opacity) * 0.1;
          
          // Update colors
          star.r = r;
          star.g = g;
          star.b = b;
          star.alpha = 0.4 + intensity * 0.6;
          
          // Store for line drawing
          starCoords[i].x = star.x;
          starCoords[i].y = star.y;
        }
        
        // Draw everything to Canvas (much faster than SVG DOM manipulation)
        const canvas = constellationCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Clear canvas
            ctx.clearRect(0, 0, 1000, 1000);
            
            // Draw constellation lines
            ctx.strokeStyle = '#e9d5ff';
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.4 + (bassSmoothed/255) * 0.5;
            
            for (let i = 0; i < 64; i++) {
              const curr = starCoords[i];
              if (!curr.active) continue;
              
              let connectionsCount = 0;
              
              for (let j = 1; j <= 5 && connectionsCount < 2; j++) {
                const nextIdx = (i + j) % 64;
                const next = starCoords[nextIdx];
                
                if (next.active) {
                  const dx = curr.x - next.x;
                  const dy = curr.y - next.y;
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  
                  if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(curr.x + 500, curr.y + 500);
                    ctx.lineTo(next.x + 500, next.y + 500);
                    ctx.stroke();
                    connectionsCount++;
                  }
                }
              }
            }
            
            // Draw stars
            for (let i = 0; i < 64; i++) {
              const star = starPositions.current[i];
              if (star.opacity < 0.05) continue;
              
              const radius = (i % 5 === 0) ? 2.5 : 1.5;
              
              // Glow effect
              ctx.shadowBlur = 5 + star.opacity * 10;
              ctx.shadowColor = `rgba(${star.r}, ${star.g}, ${star.b}, ${star.alpha})`;
              
              ctx.globalAlpha = star.opacity;
              ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${star.alpha})`;
              ctx.beginPath();
              ctx.arc(star.x + 500, star.y + 500, radius, 0, Math.PI * 2);
              ctx.fill();
            }
            
            // Reset shadow
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
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

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime
      const dur = audioRef.current.duration || 0
      progressRef.current = cur
      durationRef.current = dur
      
      updateProgressUI(cur, dur)
    }
  }

  const updateProgressUI = (cur: number, dur: number) => {
    const percent = dur > 0 ? (cur / dur) * 100 : 0
    const timeStr = formatTime(cur)
    const durStr = formatTime(dur)

    // Update Player View UI
    if (progressLineRef.current) progressLineRef.current.style.width = `${percent}%`
    if (progressThumbRef.current) progressThumbRef.current.style.left = `calc(${percent}% - 7px)`
    if (currentTimeLabelRef.current) currentTimeLabelRef.current.textContent = timeStr
    if (durationLabelRef.current) durationLabelRef.current.textContent = durStr
    if (waveformTimeLabelRef.current) waveformTimeLabelRef.current.textContent = `${timeStr} / ${durStr}`

    // Update Mini Player UI
    if (miniProgressLineRef.current) miniProgressLineRef.current.style.width = `${percent}%`
    if (miniCurrentTimeLabelRef.current) miniCurrentTimeLabelRef.current.textContent = timeStr
    if (miniDurationLabelRef.current) miniDurationLabelRef.current.textContent = durStr
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      progressRef.current = newTime
      updateProgressUI(newTime, durationRef.current)
      if (videoRef.current) {
        videoRef.current.currentTime = newTime
      }
    }
  }

  // Hook for mouse tracking on buttons to create the radial gradient effect
  const handleButtonMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    const x = e.clientX - target.getBoundingClientRect().left;
    const y = e.clientY - target.getBoundingClientRect().top;
    
    // Use requestAnimationFrame to prevent layout thrashing and lag
    requestAnimationFrame(() => {
      target.style.setProperty('--mouse-x', `${x}px`);
      target.style.setProperty('--mouse-y', `${y}px`);
    });
  };

  const handleEnded = () => {
    if (videos.length === 0 || !currentVideo) return
    
    // Loop one: replay current song
    if (playMode === 'loop-one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
      return
    }
    
    // Shuffle: pick random song
    if (playMode === 'shuffle') {
      const randomIndex = Math.floor(Math.random() * videos.length)
      setCurrentVideo(videos[randomIndex])
      setIsPlaying(true)
      return
    }
    
    // Loop all: go to next song, wrap around
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const nextIndex = (currentIndex + 1) % videos.length
    setCurrentVideo(videos[nextIndex])
    setIsPlaying(true)
  }

  const playNext = () => {
    if (!currentVideo || videos.length === 0) return
    
    // Shuffle mode: pick random song
    if (playMode === 'shuffle') {
      const randomIndex = Math.floor(Math.random() * videos.length)
      setCurrentVideo(videos[randomIndex])
      setIsPlaying(true)
      return
    }
    
    // Normal/loop mode: go to next song
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const nextIndex = (currentIndex + 1) % videos.length
    setCurrentVideo(videos[nextIndex])
    setIsPlaying(true)
  }

  const handleAddToPlaylist = (videoId: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    
    const newPlaylist = [...playlist, videoId]
    setPlaylist(newPlaylist)
    localStorage.setItem('playlist', JSON.stringify(newPlaylist))
  }

  const handleRemoveFromPlaylist = (index: number) => {
    const newPlaylist = playlist.filter((_, i) => i !== index)
    setPlaylist(newPlaylist)
    localStorage.setItem('playlist', JSON.stringify(newPlaylist))
  }

  const handleDragOverItem = (draggedIdx: number, targetIdx: number) => {
    if (draggedIdx === targetIdx) return
    
    // Swap items in real-time
    const newPlaylist = [...playlist]
    const [removed] = newPlaylist.splice(draggedIdx, 1)
    newPlaylist.splice(targetIdx, 0, removed)
    setPlaylist(newPlaylist)
    setDraggedIndex(targetIdx) // Update dragged index to new position
  }

  const handleLike = async (videoId: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    
    const isLiked = likedVideos.has(videoId)
    const endpoint = isLiked ? 'unlike' : 'like'
    
    try {
      const response = await axios.post(`/api/videos/${videoId}/${endpoint}`)
      if (response.data.success) {
        // Update local liked state
        const newLiked = new Set(likedVideos)
        if (isLiked) {
          newLiked.delete(videoId)
        } else {
          newLiked.add(videoId)
        }
        setLikedVideos(newLiked)
        localStorage.setItem('likedVideos', JSON.stringify(Array.from(newLiked)))
        
        // Update video likes count in state
        setVideos(videos.map(v => 
          v.id === videoId ? { ...v, likes: response.data.likes } : v
        ))
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  // Filter videos based on search query
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos
    return videos.filter(video => 
      video.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [videos, searchQuery])

  const playPrev = () => {
    if (!currentVideo || videos.length === 0) return
    
    // Shuffle mode: pick random song
    if (playMode === 'shuffle') {
      const randomIndex = Math.floor(Math.random() * videos.length)
      setCurrentVideo(videos[randomIndex])
      setIsPlaying(true)
      return
    }
    
    // Normal/loop mode: go to previous song
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id)
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length
    setCurrentVideo(videos[prevIndex])
    setIsPlaying(true)
  }

  // Memoize waveform bars — only created ONCE, never torn down on re-render
  const waveformBars = useMemo(() => {
    const bars = 64;
    const radius = 180;
    const items = [];
    barsRef.current = new Array(bars).fill(null);

    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const rotation = angle * (180 / Math.PI) + 90;

      items.push(
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="absolute w-1.5 bg-white rounded-full origin-bottom"
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
            height: '10px',
            transitionProperty: 'height, box-shadow',
            transitionDuration: '75ms',
          }}
        />
      );
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps: bars never need to be recreated

  return (
    <div className="flex h-screen bg-[#1c1d25] text-zinc-300 font-sans overflow-hidden fixed inset-0">
      
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
          
          /* Glow Button Hover Effect */
          .glow-button {
            position: relative;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.1);
            transition: background-color 0.3s ease, transform 0.3s ease;
          }
          .glow-button:hover {
            background-color: rgba(168, 85, 247, 0.9); /* Solid purple on hover */
          }
          .glow-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: inherit;
            padding: 1.5px; /* Border thickness */
            background: radial-gradient(
              circle 40px at var(--mouse-x, 50%) var(--mouse-y, 50%), 
              rgba(255, 255, 255, 0.9),
              transparent 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
          }
          .glow-button:hover::before {
            opacity: 1;
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
      <div className={`absolute inset-0 z-50 flex flex-col bg-black transition-transform duration-500 ease-in-out overflow-hidden ${viewMode === 'playing' ? 'translate-y-0 opacity-100 visible' : 'translate-y-full opacity-0 invisible'}`}>
        
        {/* Background Layer */}
        <div className="absolute inset-0 overflow-hidden">
          {currentVideo && (
            bgMode === 'blur' ? (
              <>
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 scale-110 blur-xl transition-all duration-1000"
                  style={{ backgroundImage: `url(/static/figures/${currentVideo.id}.jpg)` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
              </>
            ) : (
              <video 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-90"
                muted
                playsInline
                preload="none"
                loop={false}
              />
            )
          )}
        </div>

        {/* Content Layer */}
        <div className="relative z-10 flex flex-col h-full p-4 sm:p-8 overflow-hidden">
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
                  <Music size={14} /> Music
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-visible">
            {bgMode === 'blur' && (
              <div 
                className="relative w-[min(90vw,400px)] h-[min(90vw,400px)] max-w-[400px] max-h-[400px] flex items-center justify-center pointer-events-auto"
                style={showEntranceAnimation ? {
                  opacity: 0,
                  animationName: 'fadeInContent',
                  animationDuration: '0.5s',
                  animationDelay: '1.5s',
                  animationFillMode: 'forwards'
                } : {}}
              >
                {/* Outer Ring with Glow */}
                <div className="absolute inset-4 border-4 border-purple-500 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.8),0_0_60px_rgba(168,85,247,0.5),0_0_90px_rgba(168,85,247,0.3)]" />
                
                {/* Constellation Canvas Layer (replaces SVG for performance) */}
                <canvas 
                  ref={constellationCanvasRef}
                  width={1000}
                  height={1000}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%] pointer-events-none z-10"
                  style={{ imageRendering: 'auto' }}
                />

                {/* Waveform */}
                {waveformBars}
                
                {/* Inner Cover/Info */}
                <div 
                  ref={waveformContainerRef}
                  id="waveform-container"
                  className="absolute inset-8 rounded-full overflow-hidden shadow-2xl border-2 border-white/10 bg-black/40 backdrop-blur-sm transition-transform duration-75"
                >
                  {currentVideo && (
                    <>
                      <img 
                        src={`/static/figures/${currentVideo.id}.jpg`} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover opacity-30" 
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                        <h1 className="text-2xl font-bold text-white mb-2 line-clamp-3 leading-snug drop-shadow-md">
                          {currentVideo.title}
                        </h1>
                        <p ref={waveformTimeLabelRef} className="text-lg text-purple-300 font-mono mt-2 drop-shadow-md">
                          00:00 / 00:00
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
            <div className="flex items-center gap-6 w-full">
              <span ref={currentTimeLabelRef} className="text-sm font-bold font-mono text-purple-400 w-12 text-right drop-shadow-md">00:00</span>
              <div className="flex-1 h-1.5 relative group cursor-pointer flex items-center">
                <input 
                  type="range" 
                  min="0" 
                  max={durationRef.current || 100} 
                  defaultValue="0"
                  onChange={handleProgressChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {/* Background track line */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden transition-all group-hover:h-1.5 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                  {/* Filled track line */}
                  <div 
                    ref={progressLineRef}
                    className="h-full bg-purple-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.8)] relative"
                    style={{ width: '0%' }}
                  ></div>
                </div>
                {/* Thumb/Handle */}
                <div 
                  ref={progressThumbRef}
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)] opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none"
                  style={{ left: `calc(0% - 7px)` }}
                ></div>
              </div>
              <span ref={durationLabelRef} className="text-sm font-bold font-mono text-purple-400 w-12 drop-shadow-md">00:00</span>
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
            {/* Volume Control */}
            <button 
              onClick={() => {
                if (isMuted) {
                  setIsMuted(false)
                  if (audioRef.current) audioRef.current.volume = volume
                } else {
                  setIsMuted(true)
                  if (audioRef.current) audioRef.current.volume = 0
                }
              }}
              onMouseMove={handleButtonMouseMove}
              className="glow-button w-12 h-12 rounded-full backdrop-blur-xl text-white/80 hover:text-white flex items-center justify-center hover:scale-110 shadow-2xl transition"
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <button 
              onClick={playPrev} 
              onMouseMove={handleButtonMouseMove}
              className="glow-button w-14 h-14 rounded-full backdrop-blur-xl text-white flex items-center justify-center hover:scale-110 shadow-2xl"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button 
              onClick={togglePlay}
              onMouseMove={handleButtonMouseMove}
              className="glow-button w-18 h-18 p-5 rounded-full backdrop-blur-xl text-white flex items-center justify-center hover:scale-105 shadow-2xl"
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>
            <button 
              onClick={playNext} 
              onMouseMove={handleButtonMouseMove}
              className="glow-button w-14 h-14 rounded-full backdrop-blur-xl text-white flex items-center justify-center hover:scale-110 shadow-2xl"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>

            {/* Play Mode Toggle */}
            <button 
              onClick={() => {
                if (playMode === 'loop') setPlayMode('loop-one')
                else if (playMode === 'loop-one') setPlayMode('shuffle')
                else setPlayMode('loop')
              }}
              onMouseMove={handleButtonMouseMove}
              className="glow-button w-12 h-12 rounded-full backdrop-blur-xl text-white/80 hover:text-white flex items-center justify-center hover:scale-110 shadow-2xl transition"
              title={playMode === 'loop' ? 'Loop All' : playMode === 'loop-one' ? 'Loop One' : 'Shuffle'}
            >
              {playMode === 'loop' ? <Repeat size={20} /> : playMode === 'loop-one' ? <Repeat1 size={20} /> : <Shuffle size={20} />}
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
                animationFillMode: 'forwards',
                filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.8)) drop-shadow(0 0 20px rgba(168,85,247,0.6)) drop-shadow(0 0 30px rgba(168,85,247,0.4))'
              }}
            >
              <circle 
                cx="200" 
                cy="200" 
                r="180" 
                fill="none" 
                stroke="#a855f7" 
                strokeWidth="8" 
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
      
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex md:flex-col w-64 bg-[#1f2129] pt-8 shrink-0 relative z-20">
        <div className="px-8 pb-8 flex items-center gap-3 font-bold text-xl text-white cursor-pointer" onClick={() => setViewMode('browse')}>
          <img 
            src="/logo.png" 
            alt="Hachimi Music" 
            className="w-14 h-14 rounded-full object-cover"
          />
          Hachimi Music
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
            <button 
              onClick={() => setViewMode('playlists')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition mt-8 ${viewMode === 'playlists' ? 'bg-zinc-800/40 text-white border-l-2 border-purple-500' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${viewMode === 'playlists' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5'}`}>
                <Menu size={16} />
              </div>
              <span className="font-medium">Playlists</span>
              {playlist.length > 0 && (
                <span className="ml-auto bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {playlist.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setViewMode('favorites')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition ${viewMode === 'favorites' ? 'bg-zinc-800/40 text-white border-l-2 border-purple-500' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${viewMode === 'favorites' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5'}`}>
                <Heart size={16} />
              </div>
              <span className="font-medium">Favorites</span>
            </button>

            {/* Mambo Dance Animation - Below Favorites */}
            <div className="w-full flex justify-center items-center mt-6 px-4">
              <video 
                src="/mambo_dance.webm" 
                autoPlay
                loop
                muted
                playsInline
                className="w-[85%] h-auto border-0 outline-none"
                style={{ border: 'none', outline: 'none' }}
                onError={(e) => {
                  console.error('Failed to load mambo_dance.webm')
                  e.currentTarget.style.display = 'none'
                }}
                onLoadedData={() => console.log('✅ Mambo dance video loaded in sidebar')}
              />
            </div>
          </div>
        </nav>
      </aside>

      {/* Browse Content Area */}
      <main className="flex-1 flex flex-col h-full relative z-10 bg-[#1c1d25] pb-28">
        
        {/* Header */}
        <header className="h-20 md:h-24 px-4 md:px-10 flex items-center justify-between shrink-0 w-full">
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <Input 
              type="text" 
              placeholder="Search" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 h-12 bg-white/5 border border-white/10 rounded-full text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:bg-white/10 transition-all shadow-sm"
            />
          </div>
          
          {/* Social Links */}
          <div className="flex items-center gap-3 ml-6">
            <a
              href="https://discord.gg/AgzgTX86"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white transition-all hover:scale-105 shadow-lg hover:shadow-xl"
              title="Join our Discord"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-sm font-medium">Discord</span>
            </a>
            
            <a
              href="https://github.com/Blackriver-T09/Hachimi-US"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-all hover:scale-105 shadow-lg hover:shadow-xl"
              title="View on GitHub"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-sm font-medium">GitHub</span>
            </a>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 custom-scrollbar text-left w-full max-w-7xl mx-auto">
          {viewMode === 'browse' && (
            <div className="mb-12 text-left">
              <div className="flex justify-between items-end mb-8 text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Music Library</h2>
                <button className="text-sm font-medium text-purple-400 hover:text-purple-300 transition hidden md:inline-block">See all</button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 text-left">
                {filteredVideos.map(video => (
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
                  <div className="aspect-square mb-4 relative bg-black/50 rounded-xl overflow-hidden">
                    <img 
                      src={`/static/figures/${video.id}.jpg`} 
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 will-change-transform"
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleAddToPlaylist(video.id, e)}
                        className="p-1.5 rounded-full hover:bg-white/10 transition opacity-60 hover:opacity-100"
                        title="Add to Playlist"
                      >
                        <ListPlus size={16} />
                      </button>
                      <button
                        onClick={(e) => handleLike(video.id, e)}
                        className={`p-1.5 rounded-full hover:bg-white/10 transition flex items-center gap-1 ${
                          likedVideos.has(video.id) ? 'text-red-400' : 'opacity-60 hover:opacity-100'
                        }`}
                        title={likedVideos.has(video.id) ? 'Unlike' : 'Like'}
                      >
                        <Heart size={16} fill={likedVideos.has(video.id) ? 'currentColor' : 'none'} />
                        <span className="text-xs">{video.likes}</span>
                      </button>
                    </div>
                    <span className="shrink-0 bg-black/30 px-2 py-1 rounded text-zinc-300">
                      {currentVideo?.id === video.id ? formatTime(durationRef.current) : '00:00'}
                    </span>
                  </div>
                </div>
              ))}
              
              {!isLoadingVideos && videosError && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-400 bg-[#252731] rounded-2xl border border-red-500/20">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <Search size={24} className="text-red-300" />
                  </div>
                  <p className="text-lg font-medium text-red-200">Unable to load music list</p>
                  <p className="text-sm text-zinc-400 mt-2">{videosError}</p>
                </div>
              )}

              {isLoadingVideos && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-500 bg-[#252731] rounded-2xl border border-zinc-800 border-dashed">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search size={24} className="text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-400">Loading music...</p>
                </div>
              )}

              {!isLoadingVideos && !videosError && filteredVideos.length === 0 && videos.length > 0 && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-500 bg-[#252731] rounded-2xl border border-zinc-800 border-dashed">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search size={24} className="text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-400">No results for "{searchQuery}"</p>
                  <button onClick={() => setSearchQuery("")} className="text-purple-400 hover:text-purple-300 mt-2 text-sm font-medium px-4 py-2 bg-purple-500/10 rounded-full hover:bg-purple-500/20 transition">Clear search</button>
                </div>
              )}

              {!isLoadingVideos && !videosError && videos.length === 0 && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-500 bg-[#252731] rounded-2xl border border-zinc-800 border-dashed">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search size={24} className="text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-400">No music found</p>
                  <p className="text-sm text-zinc-500 mt-2">Add some music via the admin panel</p>
                </div>
              )}
            </div>
          </div>
          )}

          {viewMode === 'favorites' && (
            <div className="mb-12 text-left">
              <div className="flex justify-between items-end mb-8 text-left animate-[float-up_0.6s_ease-out]">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Top Favorites</h2>
                <span className="text-sm font-medium text-zinc-400">{videos.length} songs</span>
              </div>

              {/* Podium for Top 3 */}
              {videos.filter(v => v.likes > 0).length >= 3 && (
                <div className="mb-12 flex items-end justify-center gap-6">
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center animate-[float-up_0.8s_ease-out_0.3s_both]">
                    <div className="relative group cursor-pointer" onClick={() => {
                      const secondPlace = [...videos].sort((a, b) => b.likes - a.likes)[1]
                      setCurrentVideo(secondPlace)
                      setIsPlaying(true)
                      setViewMode('playing')
                    }}>
                      <div className="w-32 h-32 rounded-2xl overflow-hidden mb-3 border-4 border-zinc-400 shadow-lg shadow-zinc-400/30">
                        <img 
                          src={`/static/figures/${[...videos].sort((a, b) => b.likes - a.likes)[1].id}.jpg`}
                          alt="2nd place"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-6xl mb-2">🥈</div>
                        <p className="text-sm font-bold text-zinc-300 truncate w-32">{[...videos].sort((a, b) => b.likes - a.likes)[1].title}</p>
                        <p className="text-xs text-zinc-500 mt-1">♥ {[...videos].sort((a, b) => b.likes - a.likes)[1].likes} likes</p>
                      </div>
                    </div>
                    <div className="w-32 h-24 bg-gradient-to-t from-zinc-700 to-zinc-600 rounded-t-xl flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                      2
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="flex flex-col items-center -mt-8 animate-[float-up_0.8s_ease-out_0.15s_both]">
                    <div className="relative group cursor-pointer" onClick={() => {
                      const firstPlace = [...videos].sort((a, b) => b.likes - a.likes)[0]
                      setCurrentVideo(firstPlace)
                      setIsPlaying(true)
                      setViewMode('playing')
                    }}>
                      <div className="w-40 h-40 rounded-2xl overflow-hidden mb-3 border-4 border-yellow-400 shadow-xl shadow-yellow-400/50 ring-4 ring-yellow-400/20">
                        <img 
                          src={`/static/figures/${[...videos].sort((a, b) => b.likes - a.likes)[0].id}.jpg`}
                          alt="1st place"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-7xl mb-2">🏆</div>
                        <p className="text-base font-bold text-yellow-400 truncate w-40">{[...videos].sort((a, b) => b.likes - a.likes)[0].title}</p>
                        <p className="text-sm text-yellow-500 mt-1">♥ {[...videos].sort((a, b) => b.likes - a.likes)[0].likes} likes</p>
                      </div>
                    </div>
                    <div className="w-40 h-32 bg-gradient-to-t from-yellow-600 to-yellow-500 rounded-t-xl flex items-center justify-center text-4xl font-bold text-white shadow-xl">
                      1
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center animate-[float-up_0.8s_ease-out_0.45s_both]">
                    <div className="relative group cursor-pointer" onClick={() => {
                      const thirdPlace = [...videos].sort((a, b) => b.likes - a.likes)[2]
                      setCurrentVideo(thirdPlace)
                      setIsPlaying(true)
                      setViewMode('playing')
                    }}>
                      <div className="w-32 h-32 rounded-2xl overflow-hidden mb-3 border-4 border-amber-700 shadow-lg shadow-amber-700/30">
                        <img 
                          src={`/static/figures/${[...videos].sort((a, b) => b.likes - a.likes)[2].id}.jpg`}
                          alt="3rd place"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-6xl mb-2">🥉</div>
                        <p className="text-sm font-bold text-zinc-300 truncate w-32">{[...videos].sort((a, b) => b.likes - a.likes)[2].title}</p>
                        <p className="text-xs text-zinc-500 mt-1">♥ {[...videos].sort((a, b) => b.likes - a.likes)[2].likes} likes</p>
                      </div>
                    </div>
                    <div className="w-32 h-20 bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-xl flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                      3
                    </div>
                  </div>
                </div>
              )}

              {/* All songs sorted by likes */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 text-left">
                {[...videos].sort((a, b) => b.likes - a.likes).map(video => (
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
                      src={`/static/figures/${video.id}.jpg`} 
                      alt={video.title}
                      loading="lazy"
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleAddToPlaylist(video.id, e)}
                        className="p-1.5 rounded-full hover:bg-white/10 transition opacity-60 hover:opacity-100"
                        title="Add to Playlist"
                      >
                        <ListPlus size={16} />
                      </button>
                      <button
                        onClick={(e) => handleLike(video.id, e)}
                        className={`p-1.5 rounded-full hover:bg-white/10 transition flex items-center gap-1 ${
                          likedVideos.has(video.id) ? 'text-red-400' : 'opacity-60 hover:opacity-100'
                        }`}
                        title={likedVideos.has(video.id) ? 'Unlike' : 'Like'}
                      >
                        <Heart size={16} fill={likedVideos.has(video.id) ? 'currentColor' : 'none'} />
                        <span className="text-xs">{video.likes}</span>
                      </button>
                    </div>
                    <span className="shrink-0 bg-black/30 px-2 py-1 rounded text-zinc-300">
                      {currentVideo?.id === video.id ? formatTime(durationRef.current) : '00:00'}
                    </span>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {viewMode === 'playlists' && (
            <div className="mb-12 text-left">
              <div className="flex justify-between items-end mb-8 text-left animate-[float-up_0.6s_ease-out]">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">My Playlist</h2>
                <span className="text-sm font-medium text-zinc-400">{playlist.length} songs</span>
              </div>

              {playlist.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-500 bg-[#252731] rounded-2xl border border-zinc-800 border-dashed animate-[float-up_0.8s_ease-out_0.15s_both]">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Menu size={24} className="text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-400">Your playlist is empty</p>
                  <p className="text-sm text-zinc-500 mt-2">Click the + button on any song to add it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {playlist.map((videoId, index) => {
                    const video = videos.find(v => v.id === videoId)
                    if (!video) return null
                    
                    const isDragging = draggedIndex === index
                    const isDraggedOver = dragOverIndex === index
                    
                    return (
                      <div
                        key={`${videoId}-${index}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', index.toString())
                          setDraggedIndex(index)
                        }}
                        onDragEnter={() => {
                          if (draggedIndex !== null && draggedIndex !== index) {
                            setDragOverIndex(index)
                            handleDragOverItem(draggedIndex, index)
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget === e.target) {
                            setDragOverIndex(null)
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          // Save to localStorage on drop
                          localStorage.setItem('playlist', JSON.stringify(playlist))
                          setDraggedIndex(null)
                          setDragOverIndex(null)
                        }}
                        onDragEnd={() => {
                          // Save to localStorage on drag end
                          localStorage.setItem('playlist', JSON.stringify(playlist))
                          setDraggedIndex(null)
                          setDragOverIndex(null)
                        }}
                        className={`bg-[#252731] rounded-xl p-4 flex items-center gap-4 cursor-move hover:bg-[#2d2f3b] transition-all duration-200 group border hover:shadow-lg animate-[float-up_0.6s_ease-out] ${
                          isDragging ? 'opacity-50 scale-95 border-purple-500/50' : 
                          isDraggedOver ? 'border-purple-500 shadow-lg shadow-purple-500/20 scale-105' : 
                          'border-white/5 hover:border-white/10'
                        }`}
                        style={{ 
                          animationDelay: `${index * 0.05}s`, 
                          animationFillMode: 'both',
                          transform: isDraggedOver ? 'translateY(-4px)' : undefined
                        }}
                      >
                        {/* Drag Handle */}
                        <div className="text-zinc-600 group-hover:text-zinc-400 transition">
                          <GripVertical size={20} />
                        </div>

                        {/* Album Art */}
                        <div 
                          className="w-16 h-16 rounded-lg overflow-hidden bg-black/50 shrink-0 cursor-pointer"
                          onClick={() => {
                            setCurrentVideo(video)
                            setIsPlaying(true)
                            setViewMode('playing')
                          }}
                        >
                          <img 
                            src={`/static/figures/${video.id}.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/shapes/svg?seed=${video.id}`
                            }}
                          />
                        </div>

                        {/* Song Info */}
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            setCurrentVideo(video)
                            setIsPlaying(true)
                            setViewMode('playing')
                          }}
                        >
                          <h3 className="font-bold text-zinc-100 truncate text-base" title={video.title}>
                            {video.title}
                          </h3>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            ♥ {video.likes} likes
                          </p>
                        </div>

                        {/* Play Button */}
                        <button
                          onClick={() => {
                            setCurrentVideo(video)
                            setIsPlaying(true)
                            setViewMode('playing')
                          }}
                          className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 transition shrink-0"
                        >
                          {currentVideo?.id === video.id && isPlaying ? (
                            <Pause size={18} fill="currentColor" />
                          ) : (
                            <Play size={18} fill="currentColor" className="ml-0.5" />
                          )}
                        </button>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveFromPlaylist(index)}
                          className="w-8 h-8 rounded-full hover:bg-red-500/20 text-zinc-600 hover:text-red-400 flex items-center justify-center transition shrink-0"
                          title="Remove from playlist"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
        preload="none"
      />

      {/* Bottom Mini Player Bar (Visible in browse/favorites/playlists view when something is selected) */}
      <div className={`fixed bottom-0 left-0 right-0 h-24 bg-[#1f2129]/95 backdrop-blur-md border-t border-white/5 flex items-center px-6 z-[60] transition-transform duration-300 ${viewMode !== 'playing' && currentVideo ? 'translate-y-0' : 'translate-y-full'}`}>
        
        {/* Left: Track Info */}
        <div className="flex items-center gap-4 w-[320px] shrink-0">
          {currentVideo && (
            <>
              <div 
                className="w-14 h-14 rounded-lg bg-zinc-800 overflow-hidden cursor-pointer relative group shrink-0 shadow-md"
                onClick={() => setViewMode('playing')}
              >
                <img 
                  src={`/static/figures/${currentVideo.id}.jpg`} 
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
            <span ref={miniCurrentTimeLabelRef} className="text-[11px] font-mono text-zinc-500 w-8 text-right">00:00</span>
            <div className="flex-1 h-1 relative group cursor-pointer flex items-center">
              <input 
                type="range" 
                min="0" 
                max={durationRef.current || 100} 
                defaultValue="0"
                onChange={handleProgressChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden transition-all group-hover:h-1.5">
                <div 
                  ref={miniProgressLineRef}
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: '0%' }}
                ></div>
              </div>
            </div>
            <span ref={miniDurationLabelRef} className="text-[11px] font-mono text-zinc-500 w-8">00:00</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-[320px] shrink-0 flex justify-end items-center gap-3">
          {/* Play Mode Button */}
          <button
            onClick={() => {
              if (playMode === 'loop') setPlayMode('loop-one')
              else if (playMode === 'loop-one') setPlayMode('shuffle')
              else setPlayMode('loop')
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-purple-400 flex items-center justify-center transition border border-white/5"
            title={playMode === 'loop' ? 'Loop All' : playMode === 'loop-one' ? 'Loop One' : 'Shuffle'}
          >
            {playMode === 'loop' && <Repeat size={14} />}
            {playMode === 'loop-one' && <Repeat1 size={14} />}
            {playMode === 'shuffle' && <Shuffle size={14} />}
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2 group/volume">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition border border-white/5"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-300">
              <div className="relative w-20 h-1 bg-white/10 rounded-full">
                <div 
                  className="absolute left-0 top-0 h-full bg-purple-500 rounded-full pointer-events-none"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume * 100}
                  onChange={(e) => {
                    const newVolume = parseInt(e.target.value) / 100
                    setVolume(newVolume)
                    if (audioRef.current) audioRef.current.volume = newVolume
                    if (newVolume > 0) setIsMuted(false)
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Source Link */}
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
