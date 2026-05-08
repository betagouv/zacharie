import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { trackEvent } from '@app/services/matomo';

export default function QuizTvPage() {
  const [quizUrl, setQuizUrl] = useState<string>('');

  useEffect(() => {
    setQuizUrl(`${window.location.origin}/quiz?from=tv`);
    trackEvent('QuizTv', 'view');
  }, []);

  return (
    <main role="main" id="content" className="fr-background-alt--blue-france h-screen overflow-hidden">
      <title>Quiz Zacharie — Stand</title>
      <div className="flex h-full flex-col items-stretch gap-8 p-6 md:flex-row md:gap-12 md:p-12">
        <section className="flex flex-1 flex-col justify-center gap-6 md:gap-8">
          <img
            src="/logo_zacharie.svg"
            alt="Zacharie"
            className="h-[25vh] w-auto self-start"
          />
          <p className="fr-h4 m-0 text-gray-700">
            Du prélèvement à l’assiette,
            êtes-vous sûrs de vos pratiques ?
          </p>
          <h1 className="fr-display--xs m-0 md:fr-display--sm">
            Testons vos connaissances !
          </h1>
          <p className="m-0 mt-auto md:fr-h2 text-right">
            Scannez le QR code <span aria-hidden="true">→</span>
          </p>
        </section>

        <section className="flex flex-1 items-center justify-center md:flex-[1.2]">
          {quizUrl && (
            <div className="flex aspect-square h-full max-h-full w-auto max-w-full items-center justify-center rounded-2xl bg-white p-6 shadow-lg md:p-10">
              <QRCodeSVG
                value={quizUrl}
                level="M"
                includeMargin
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
