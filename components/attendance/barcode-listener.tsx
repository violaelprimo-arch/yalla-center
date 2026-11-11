'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, Volume2, VolumeX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BarcodeListenerProps {
  onScan: (code: string) => void;
  isEnabled?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

interface KeyStrokeRecord {
  char: string;
  time: number;
}

export function BarcodeListener({
  onScan,
  isEnabled = true,
  isMuted = false,
  onToggleMute,
}: BarcodeListenerProps) {
  const bufferRef = useRef<KeyStrokeRecord[]>([]);
  const lastKeyTimeRef = useRef<number>(0);
  const [isLaserFlashing, setIsLaserFlashing] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = [];
    lastKeyTimeRef.current = 0;
  }, []);

  const triggerVisualFlash = useCallback((code: string) => {
    setLastScannedCode(code);
    setIsLaserFlashing(true);
    setTimeout(() => setIsLaserFlashing(false), 450);
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Grade inputs are modal and own their keyboard interaction.
      if (event.target instanceof HTMLElement && event.target.closest('dialog[open]')) {
        resetBuffer();
        return;
      }

      // Ignore functional modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(event.key)) {
        return;
      }

      const now = performance.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // Reset buffer if delay exceeds threshold for hardware scanner (80ms)
      if (lastKeyTimeRef.current > 0 && timeSinceLastKey > 80) {
        bufferRef.current = [];
      }

      if (event.key === 'Enter') {
        const buffer = bufferRef.current;
        if (buffer.length >= 3) {
          const totalDuration = now - buffer[0].time;
          const avgInterval = totalDuration / (buffer.length - 1);

          // Sub-60ms average interval indicates high-speed laser hardware scanner
          if (avgInterval < 60 || totalDuration < 300) {
            event.preventDefault();
            event.stopPropagation();

            const scannedCode = buffer.map((b) => b.char).join('').trim();
            if (scannedCode) {
              triggerVisualFlash(scannedCode);
              onScan(scannedCode);
            }
          }
        }
        resetBuffer();
        return;
      }

      // Collect single character keys
      if (event.key.length === 1) {
        bufferRef.current.push({ char: event.key, time: now });
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isEnabled, onScan, resetBuffer, triggerVisualFlash]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-card border border-border/80 shadow-soft-sm">
      <div className="flex items-center gap-3">
        <div
          className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
            isLaserFlashing
              ? 'bg-brand-cyan-400 ring-4 ring-brand-cyan-400/40 scale-125'
              : 'bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse'
          }`}
        />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-cyan-500" />
            <span>قارئ الباركود الخارجي (الليزر)</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            {isLaserFlashing && lastScannedCode ? (
              <span className="text-brand-cyan-500 font-mono font-bold">
                تم التقاط الكود: {lastScannedCode}
              </span>
            ) : (
              'جاهز للاستقبال التلقائي (< 50 مللي ثانية)'
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onToggleMute && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            title={isMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم الصوت'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-500" />
            )}
            <span className="mr-1 text-[11px]">{isMuted ? 'مكتوم' : 'صوت مفعل'}</span>
          </Button>
        )}
        <Badge variant="cyan" className="text-[10px] font-mono">
          USB / BT HID Ready
        </Badge>
      </div>
    </div>
  );
}
