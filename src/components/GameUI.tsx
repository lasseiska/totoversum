import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../gameStore';
import { getCubeColor, getCubeName, getCubeConfig, CUBE_TYPES, CubeKind } from '../cubeTypes';
import { OBSIDIAN_COUNT } from '../obsidianTypes';
import { computeActiveSynergies, SYNERGIES, SynergyNotification } from '../synergies';


// ── Individual toast that auto-removes itself ────────────────────────────────
function SynergyToast({ notification, onDone }: { notification: SynergyNotification; onDone: () => void }) {
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        timerRef.current = setTimeout(onDone, 3200);
        return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className="synergy-notification"
            style={{ borderColor: notification.synergy.color }}
        >
            <span className="synergy-notif-emoji">{notification.synergy.emoji}</span>
            <div className="synergy-notif-text">
                <span className="synergy-notif-name">{notification.synergy.name}</span>
                <span className="synergy-notif-desc">{notification.synergy.description}</span>
            </div>
            <span className="synergy-notif-bonus">+{notification.bonus}</span>
        </div>
    );
}


export function GameUI() {
    const { bag, score, gameOver, resetGame, grid, cells, synergyBonus, synergyNotifications, clearSynergyNotification, isMuted, isAudioInitialized, toggleMute, initializeAudio, bgmVolume, sfxVolume, setBgmVolume, setSfxVolume } = useGameStore();
    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleInteraction = () => {
            initializeAudio();
        };
        window.addEventListener('click', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [initializeAudio]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentCube = bag[0] ?? null;
    const nextCube = bag[1] ?? null;

    // Count filled cells for progress (exclude obsidian from both total and filled)
    const totalCells = Object.keys(grid).length;
    const playableCells = totalCells - OBSIDIAN_COUNT;
    const filledCells = Object.values(grid).filter((v) => v !== null).length;

    // ── Derive tile stats from the grid ───────────────────────
    const tileStats = (() => {
        const counts: Record<string, number> = {};
        Object.values(grid).forEach((cube) => {
            if (!cube) return;
            const key = `${cube.kind}-${cube.level}-${cube.rare}`;
            counts[key] = (counts[key] ?? 0) + 1;
        });
        const result: { kind: CubeKind; level: number; rare: boolean; count: number }[] = [];
        CUBE_TYPES.forEach(({ kind }) => {
            for (let lv = 1; lv <= 4; lv++) {
                const normal = counts[`${kind}-${lv}-false`];
                const rare = counts[`${kind}-${lv}-true`];
                if (normal) result.push({ kind, level: lv, rare: false, count: normal });
                if (rare) result.push({ kind, level: lv, rare: true, count: rare });
            }
        });
        return result;
    })();

    // ── Derive synergy summary ────────────────────────────────
    const synergySummary = (() => {
        const pairs = computeActiveSynergies(grid, cells);
        // Group by synergy name
        const byName: Record<string, { name: string; emoji: string; description: string; color: string; count: number; totalBonus: number }> = {};
        for (const pair of pairs) {
            const s = pair.synergy;
            if (!byName[s.name]) {
                byName[s.name] = { name: s.name, emoji: s.emoji, description: s.description, color: s.color, count: 0, totalBonus: 0 };
            }
            byName[s.name].count++;
            byName[s.name].totalBonus += s.bonusPerPair;
        }
        return Object.values(byName);
    })();

    if (gameOver) {
        return (
            <div className="ui-overlay">
                <div className="game-over-panel">
                    <h1>🌍 Planeetta täynnä!</h1>
                    <p className="final-score">Pisteet: <strong>{score}</strong></p>
                    <p className="final-cells">Ruutuja täytetty: <strong>{totalCells}</strong></p>
                    <button className="btn-primary" onClick={resetGame}>Uusi planeetta</button>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-overlay">
            {/* Synergy toast notifications */}
            {synergyNotifications.length > 0 && (
                <div className="synergy-notifications">
                    {synergyNotifications.map((n) => (
                        <SynergyToast
                            key={n.id}
                            notification={n}
                            onDone={() => clearSynergyNotification(n.id)}
                        />
                    ))}
                </div>
            )}

            {/* Top bar */}
            <div className="top-bar">
                <div className="score-display">
                    <span className="score-label">Pisteet</span>
                    <span className="score-value">{score}</span>
                </div>
                <div className="brand">🌍 TOTOVERSUM</div>
                <div className="top-bar-actions" ref={settingsRef}>
                    <button 
                        className={`btn-audio${isMuted ? ' is-muted' : ''}`} 
                        onClick={(e) => {
                            e.stopPropagation(); // prevent window click listener
                            toggleMute();
                        }}
                        title={isMuted ? "Poista mykistys" : "Mykistä peli"}
                        aria-label={isMuted ? "Poista mykistys" : "Mykistä peli"}
                    >
                        <div className="sound-wave">
                            <span className="sound-wave-bar"></span>
                            <span className="sound-wave-bar"></span>
                            <span className="sound-wave-bar"></span>
                            <span className="sound-wave-bar"></span>
                        </div>
                        <span className="mute-line"></span>
                    </button>
                    
                    <button
                        className={`btn-audio-settings${showSettings ? ' is-active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSettings(!showSettings);
                        }}
                        title="Ääniasetukset"
                        aria-label="Ääniasetukset"
                    >
                        ⚙️
                    </button>

                    {showSettings && (
                        <div className="audio-settings-popup">
                            <div className="audio-settings-title">ÄÄNIASETUKSET</div>
                            
                            <div className="slider-group">
                                <div className="slider-label">
                                    <span>🎵 Musiikki</span>
                                    <span>{Math.round(bgmVolume * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={Math.round(bgmVolume * 100)}
                                    onChange={(e) => setBgmVolume(parseInt(e.target.value) / 100)}
                                />
                            </div>

                            <div className="slider-group">
                                <div className="slider-label">
                                    <span>🔊 Efektit</span>
                                    <span>{Math.round(sfxVolume * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={Math.round(sfxVolume * 100)}
                                    onChange={(e) => setSfxVolume(parseInt(e.target.value) / 100)}
                                />
                            </div>
                        </div>
                    )}

                    <button className="btn-secondary" onClick={resetGame}>Uusi peli</button>
                </div>
            </div>

            <div className="bottom-row">
                <div className="left-column">
                    {/* Bag / current cube panel */}
                    <div className="bag-panel">
                        <div className="bag-current">
                            <div className="cube-label">Seuraava</div>
                            {currentCube && (
                                <div className="cube-preview" style={{ background: getCubeColor(currentCube) }}>
                                    <span className="cube-emoji">{getCubeConfig(currentCube.kind).emoji}</span>
                                    <span className="cube-name">{getCubeName(currentCube)}</span>
                                </div>
                            )}
                        </div>

                        {nextCube && (
                            <div className="bag-next">
                                <div className="cube-label">Sen jälkeen</div>
                                <div
                                    className="cube-preview cube-preview--small"
                                    style={{ background: getCubeColor(nextCube) }}
                                >
                                    <span className="cube-emoji">{getCubeConfig(nextCube.kind).emoji}</span>
                                </div>
                            </div>
                        )}

                        <div className="bag-count">
                            <span className="bag-count-value">∞</span>
                            <span className="bag-count-label">repussa</span>
                        </div>
                        <div className="cells-progress">
                            <span className="cells-progress-value">{filledCells}/{playableCells}</span>
                            <span className="cells-progress-label">ruutua</span>
                        </div>
                    </div>

                    {/* Tile scoreboard */}
                    {tileStats.length > 0 && (
                        <div className="scoreboard-panel">
                            <div className="scoreboard-title">🌍 Planeetalla</div>
                            <div className="scoreboard-list">
                                {tileStats.map(({ kind, level, rare, count }) => {
                                    const cfg = getCubeConfig(kind);
                                    const name = rare ? cfg.rareVariant.name : cfg.levels[level - 1].name;
                                    const color = rare ? cfg.rareVariant.color : cfg.levels[level - 1].color;
                                    return (
                                        <div key={`${kind}-${level}-${rare}`} className="scoreboard-row">
                                            <span className="sb-emoji">{cfg.emoji}</span>
                                            <div
                                                className={`sb-level-badge${rare ? ' sb-level-badge--rare' : ''}`}
                                                style={{ background: color }}
                                            >
                                                {rare ? '✨' : `L${level}`}
                                            </div>
                                            <span className="sb-name">{name}</span>
                                            <span className="sb-count">×{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="scoreboard-row">
                                <span className="sb-emoji">🖤</span>
                                <div className="sb-level-badge" style={{ background: '#2d1b4e' }}>⛏</div>
                                <span className="sb-name">Obsidiaani</span>
                                <span className="sb-count">×{OBSIDIAN_COUNT}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="right-column">
                    {/* Synergy info panel */}
                    {synergySummary.length > 0 && (
                        <div className="synergy-panel">
                            <div className="synergy-title">⚡ Synergiat</div>
                            <div className="synergy-list">
                                {synergySummary.map((s) => (
                                    <div key={s.name} className="synergy-row">
                                        <span className="synergy-emoji">{s.emoji}</span>
                                        <div className="synergy-info">
                                            <span className="synergy-name">{s.name}</span>
                                            <span className="synergy-desc">{s.description}</span>
                                        </div>
                                        <span className="synergy-count">×{s.count}</span>
                                        <span className="synergy-bonus">+{s.totalBonus}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="synergy-total">
                                <span className="synergy-total-label">Yhteensä</span>
                                <span className="synergy-total-value">+{synergyBonus}</span>
                            </div>
                        </div>
                    )}

                    {/* Synergy guide (always visible) */}
                    <div className="synergy-guide-panel">
                        <div className="synergy-guide-title">⚡ Biomisynergiat</div>
                        <div className="synergy-guide-hint">Vierekkäiset biomit → bonus!</div>
                        <div className="synergy-guide-list">
                            {SYNERGIES.map((s) => (
                                <div key={s.name} className="synergy-guide-row">
                                    <span className="synergy-guide-emoji">{s.emoji}</span>
                                    <span className="synergy-guide-desc">{s.description}</span>
                                    <span className="synergy-guide-bonus">+{s.bonusPerPair}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="legend-panel">
                        <div className="legend-title">Tasot</div>
                        <div className="legend-hint">3+ vierekkäin → merge ✨</div>
                        <div className="legend-hint">4+ → harvinainen 🌟</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
