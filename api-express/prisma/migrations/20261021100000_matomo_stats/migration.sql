-- CreateTable
CREATE TABLE "matomo_visits_daily" (
    "date" DATE NOT NULL,
    "nb_visits" INTEGER NOT NULL,
    "nb_uniq_visitors" INTEGER,
    "nb_actions" INTEGER NOT NULL,
    "bounce_rate" DOUBLE PRECISION NOT NULL,
    "avg_time_on_site" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matomo_visits_daily_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "matomo_pages_daily" (
    "date" DATE NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nb_visits" INTEGER NOT NULL,
    "nb_hits" INTEGER NOT NULL,
    "avg_time_on_page" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matomo_pages_daily_pkey" PRIMARY KEY ("date","url")
);

-- CreateTable
CREATE TABLE "matomo_events_daily" (
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "nb_events" INTEGER NOT NULL,
    "nb_visits" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matomo_events_daily_pkey" PRIMARY KEY ("date","category","action")
);

-- CreateTable
CREATE TABLE "matomo_referrers_daily" (
    "date" DATE NOT NULL,
    "referrer_type" TEXT NOT NULL,
    "nb_visits" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matomo_referrers_daily_pkey" PRIMARY KEY ("date","referrer_type")
);
