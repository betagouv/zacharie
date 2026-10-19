import { useEffect, useRef, useState } from 'react';

// au-delà, l'enregistrement dépasse la taille acceptée par le serveur
const MAX_DUREE_MS = 60_000;

// Dictée par le micro du navigateur. Dans l'app mobile (WebView), le micro n'est pas autorisé :
// on y dicte avec le micro du clavier.
export const isDicteeSupported =
  typeof window !== 'undefined' &&
  !window.ReactNativeWebView &&
  typeof MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

export default function useDictee(onRecorded: (audio: Blob) => void) {
  const [isRecording, setIsRecording] = useState(false);
  // le flux du micro, pour afficher l'onde pendant l'enregistrement
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;
  // fermé en cours d'enregistrement : on libère le micro sans envoyer l'audio
  const isUnmountedRef = useRef(false);

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const start = async () => {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // le chat a été fermé pendant la demande d'accès au micro
    if (isUnmountedRef.current) {
      micStream.getTracks().forEach((track) => track.stop());
      return;
    }
    const recorder = new MediaRecorder(micStream);
    const chunks: Array<Blob> = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      micStream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      if (isUnmountedRef.current) return;
      setIsRecording(false);
      setStream(null);
      if (chunks.length > 0) onRecordedRef.current(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setStream(micStream);
    timerRef.current = setTimeout(stop, MAX_DUREE_MS);
  };

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      stop();
    };
  }, []);

  return { isRecording, stream, start, stop };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
