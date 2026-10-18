'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Flashlight, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraQrScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function CameraQrScanner({ isOpen, onClose, onScan }: CameraQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startScanLoop = useCallback(() => {
    const BarcodeDetectorClass =
      typeof window !== 'undefined'
        ? (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
        : undefined;

    if (!BarcodeDetectorClass) {
      // Browser fallback message or simulation
      return;
    }

    let detector: { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
    try {
      detector = new BarcodeDetectorClass({
        formats: ['qr_code', 'code_128', 'ean_13', 'code_39'],
      });
    } catch {
      return;
    }

    const scanFrame = async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
      ) {
        try {
          const now = performance.now();
          if (now - lastScannedTimeRef.current > 1500) {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const detectedValue = barcodes[0].rawValue;
              if (detectedValue) {
                lastScannedTimeRef.current = now;
                onScan(detectedValue);
              }
            }
          }
        } catch {
          // ignore transient detection errors
        }
      }
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [onScan]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setErrorMessage(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('المتصفح لا يدعم الوصول المباشر لكاميرا الجهاز.');
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check torch capability
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack && typeof videoTrack.getCapabilities === 'function'
          ? (videoTrack.getCapabilities() as unknown as { torch?: boolean })
          : undefined;
        setHasTorch(Boolean(capabilities?.torch));

        // Enumerate camera devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setCameras(videoDevices);
        if (!selectedCameraId && videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }

        // Start scanning loop
        startScanLoop();
      } catch (err: unknown) {
        const error = err as { name?: string };
        setErrorMessage(
          error.name === 'NotAllowedError'
            ? 'تم رفض إذن الوصول إلى الكاميرا من إعدادات المتصفح.'
            : 'تعذر تشغيل كاميرا الجهاز، يرجى التأكد من توصيلها.'
        );
      }
    },
    [stopCamera, startScanLoop, selectedCameraId]
  );

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0] as MediaStreamTrack & {
      applyConstraints?: (constraints: unknown) => Promise<void>;
    };
    if (track && hasTorch && track.applyConstraints) {
      const nextTorch = !isTorchOn;
      try {
        await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
        setIsTorchOn(nextTorch);
      } catch {
        // Torch constraint failed
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(selectedCameraId);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, selectedCameraId, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="card-elevated w-full max-w-lg rounded-3xl border border-border overflow-hidden shadow-2xl bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-cyan-500" />
            <h3 className="text-base font-bold text-foreground">المسح الضوئي عبر الكاميرا</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative aspect-square w-full bg-black overflow-hidden flex items-center justify-center">
          {errorMessage ? (
            <div className="text-center p-6 space-y-3">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
              <p className="text-sm text-rose-400 font-medium">{errorMessage}</p>
              <Button size="sm" onClick={() => startCamera(selectedCameraId)}>
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* HUD Targeting Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-64 border-2 border-brand-cyan-400/50 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  {/* Corner Guides */}
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand-cyan-400 rounded-tr-lg" />
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand-cyan-400 rounded-tl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand-cyan-400 rounded-br-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand-cyan-400 rounded-bl-lg" />

                  {/* Animated Laser Sweep */}
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-brand-cyan-400 to-transparent shadow-[0_0_12px_#06b6d4] animate-pulse mt-32" />
                </div>
              </div>

              <div className="absolute bottom-3 inset-x-0 text-center">
                <span className="px-3 py-1 rounded-full bg-black/70 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                  وجّه الكاميرا نحو كود الطالب أو الباركود
                </span>
              </div>
            </>
          )}
        </div>

        {/* Controls Footer */}
        <div className="flex items-center justify-between p-3.5 bg-muted/40 border-t border-border">
          <div className="flex items-center gap-2">
            {hasTorch && (
              <Button
                variant={isTorchOn ? 'primary' : 'outline'}
                size="sm"
                onClick={toggleTorch}
                className="h-8 gap-1.5 text-xs"
              >
                <Flashlight className="w-3.5 h-3.5" />
                <span>{isTorchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}</span>
              </Button>
            )}

            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
              >
                {cameras.map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || `كاميرا ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
