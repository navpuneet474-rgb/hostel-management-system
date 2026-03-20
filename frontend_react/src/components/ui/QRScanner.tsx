import React, { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Button, Alert, LoadingSpinner, Card } from './';
import { cn } from '../../utils/cn';

export interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  className?: string;
  isActive?: boolean;
}

export interface GuestVerificationData {
  id?: string;
  guest_name: string;
  guest_phone: string;
  purpose: string;
  from_time: string;
  to_time: string;
  student_name?: string;
  room_number?: string;
  status: 'valid' | 'expired' | 'invalid' | 'already_entered' | 'exited';
  guest_photo?: string;
  verification_code?: string;
  entry_time?: string;
  exit_time?: string;
  current_status?: 'inside' | 'outside';
}

const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onError,
  className,
  isActive = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!videoRef.current || !isActive) return;

    const initScanner = async () => {
      try {
        // Check if camera is available
        const hasCamera = await QrScanner.hasCamera();
        setHasCamera(hasCamera);

        if (!hasCamera) {
          setError('No camera found. Please use manual code input.');
          return;
        }

        // Initialize QR scanner
        qrScannerRef.current = new QrScanner(
          videoRef.current!,
          (result) => {
            onScan(result.data);
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment', // Use back camera on mobile
          }
        );

        await qrScannerRef.current.start();
        setIsScanning(true);
        setError('');
      } catch (err) {
        console.error('Error initializing QR scanner:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize camera';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    };

    initScanner();

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      setIsScanning(false);
    };
  }, [isActive, onScan, onError]);

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      setIsScanning(false);
    }
  };

  const startScanning = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.start();
        setIsScanning(true);
        setError('');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    }
  };

  if (!hasCamera) {
    return (
      <div className={cn('text-center p-6', className)}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-sm text-gray-600">
          Camera not available. Please use manual verification code input.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="relative">
        <video
          ref={videoRef}
          className={cn(
            'w-full h-64 bg-black rounded-lg object-cover',
            !isScanning && 'opacity-50'
          )}
          playsInline
          muted
        />
        
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <div className="text-center text-white">
              <LoadingSpinner size="lg" className="mb-2" />
              <p className="text-sm">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white border-dashed rounded-lg opacity-75">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
            </div>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded-full text-sm">
              Point camera at QR code
            </div>
          </div>
        )}
      </div>

      <div className="flex space-x-2">
        {isScanning ? (
          <Button
            variant="secondary"
            onClick={stopScanning}
            className="flex-1"
          >
            Stop Scanning
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={startScanning}
            className="flex-1"
          >
            Start Scanning
          </Button>
        )}
      </div>
    </div>
  );
};

export { QRScanner };