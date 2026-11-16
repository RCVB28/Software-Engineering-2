import { useEffect, useRef } from 'react';

interface GoogleSignInProps {
  clientId: string;
  onCredential: (credential: string) => void;
}

const SCRIPT_ID = 'google-identity-services';

export function GoogleSignIn({ clientId, onCredential }: GoogleSignInProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    const render = () => {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => callbackRef.current(response.credential)
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: '320'
      });
    };

    if (window.google) {
      render();
      return;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    return () => script?.removeEventListener('load', render);
  }, [clientId]);

  return <div ref={containerRef} data-testid="google-signin" />;
}
