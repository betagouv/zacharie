"use client";

import { createConsentManagement } from "@codegouvfr/react-dsfr/consentManagement";

export const {
  ConsentBannerAndConsentManagement,
  FooterConsentManagementItem,
  FooterPersonalDataPolicyItem,
  useConsent,
} = createConsentManagement({
  /*
        Can be an object or a function that take the current language as argument.
        You should here describe the finalities of the cookies you use so that the user can choose to accept or not.
    */
  finalityDescription: () => ({
    // advertising: {
    //   title: "Publicité",
    //   description:
    //     "Nous utilisons des cookies pour vous proposer des publicités adaptées à vos centres d’intérêts et mesurer leur efficacité.",
    // },
    analytics: {
      title: "Analyse",
      description:
        "Nous utilisons des cookies pour mesurer l’audience de notre site et améliorer son contenu.",
    },
    // personalization: {
    //   title: "Personnalisation",
    //   description:
    //     "Nous utilisons des cookies pour vous proposer des contenus adaptés à vos centres d’intérêts.",
    // },
    // instagram: {
    //   title: "Instagram integration",
    //   description: "We use cookies to display Instagram content.",
    // },
    statistics: {
      title: "Statistiques",
      description:
        "Nous utilisons des cookies pour mesurer l’audience de notre site et améliorer son contenu.",
      /* You can add subFinalities to a finality in order to let the user choose more precisely what he accepts.  */
      subFinalities: {
        deviceInfo: "Informations sur votre appareil",
        traffic: "Informations sur votre navigation",
      },
    },
  }),
  /*
    If you have a page that describe your personal data policy, you can link to it here.
    Like any other *LinkProps you can turn it into a button by using { href: "#", onClick: ... }
    (if you are using react-router it will be `to` instead of `href`).
    */
  personalDataPolicyLinkProps: {
    href: "/politique-de-confidentialite",
  },
  /*
    This optional callback is called when the user take stance on what he accept and refuse.
    It gives you the opportunity to perform asynchronous actions before the user can continue to navigate.

    */
  consentCallback: async ({ finalityConsent, finalityConsent_prev }) => {
    /*
        Given the finalityDescription used in this example the Finality consent object will be of the form:
        {
            advertising: boolean;
            analytics: boolean;
            personalization: boolean;
            instagram: boolean;
            statistics: {
                deviceInfo: boolean;
                traffic: boolean;
                isFullConsent: boolean;
            };
            isFullConsent: boolean;
        }

        The finalityConsent_prev represent the previous consent object.
        If the user is taking stance for the first time, finalityConsent_prev will be undefined.
        finalityConsent_prev is restored from the localStorage.
        */
    /*
        Example with Google Analytics:

        window.gtag("consent", "update", {
            analytics_storage: finalityConsent.statistics.isFullConsent ? "granted" : "denied"
        });

        */
    /*
        Example: Reload the page if the user refuse cookies.
        if( finalityConsent_prev === undefined && !finalityConsent.isFullConsent ){
            //Do something async
            location.reload();
        }
        */
  },
});
