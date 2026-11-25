import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { scrubSensitive, scrubString } from '@app/utils/scrub-sensitive';

interface Context {
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  [key: string]: unknown;
}

type ErrorType = Error | string;

interface PerformanceMetrics {
  network: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  timing: {
    ttfb: number | null;
    domContentLoaded: number | null;
    loadComplete: number | null;
  };
  memory: {
    used: number;
    limit: number;
    percentage: string;
  } | null;
  slowResources: Array<{ name: string; duration: number }>;
}

interface PerformanceTags {
  connection_quality: 'very_bad' | 'bad' | 'ok' | 'good' | 'excellent' | 'unknown';
  page_load_speed: 'very_slow' | 'slow' | 'ok' | 'fast' | 'unknown';
  memory_pressure: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  network_type: string;
  has_slow_resources: 'yes' | 'no';
}

function getConnectionQuality(
  ttfb: number | null,
  effectiveType?: string,
  rtt?: number
): PerformanceTags['connection_quality'] {
  if (ttfb !== null) {
    if (ttfb < 100) return 'excellent';
    if (ttfb < 200) return 'good';
    if (ttfb < 500) return 'ok';
    if (ttfb < 1000) return 'bad';
    return 'very_bad';
  }

  if (effectiveType) {
    if (effectiveType === '4g') return 'good';
    if (effectiveType === '3g') return 'ok';
    if (effectiveType === '2g') return 'bad';
    if (effectiveType === 'slow-2g') return 'very_bad';
  }

  if (rtt !== undefined) {
    if (rtt < 100) return 'excellent';
    if (rtt < 300) return 'good';
    if (rtt < 600) return 'ok';
    if (rtt < 1000) return 'bad';
    return 'very_bad';
  }

  return 'unknown';
}

function getPageLoadSpeed(
  domContentLoaded: number | null,
  loadComplete: number | null
): PerformanceTags['page_load_speed'] {
  const metric = loadComplete || domContentLoaded;

  if (metric === null) return 'unknown';

  if (metric < 1000) return 'fast';
  if (metric < 2500) return 'ok';
  if (metric < 4000) return 'slow';
  return 'very_slow';
}

function getMemoryPressure(memory: PerformanceMetrics['memory']): PerformanceTags['memory_pressure'] {
  if (!memory) return 'unknown';

  const percentage = Number.parseFloat(memory.percentage);

  if (percentage < 50) return 'low';
  if (percentage < 70) return 'medium';
  if (percentage < 85) return 'high';
  return 'critical';
}

export function getPerformanceContext(): {
  metrics: PerformanceMetrics;
  tags: PerformanceTags;
} {
  interface NavigatorConnection {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }

  interface NavigatorWithConnection extends Navigator {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }

  interface PerformanceMemory {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  }

  interface PerformanceWithMemory extends Performance {
    memory?: PerformanceMemory;
  }

  const connection =
    (navigator as NavigatorWithConnection).connection ||
    (navigator as NavigatorWithConnection).mozConnection ||
    (navigator as NavigatorWithConnection).webkitConnection;

  const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

  const timing = {
    ttfb: navTiming ? Math.round(navTiming.responseStart - navTiming.requestStart) : null,
    domContentLoaded: navTiming
      ? Math.round(navTiming.domContentLoadedEventEnd - navTiming.fetchStart)
      : null,
    loadComplete: navTiming ? Math.round(navTiming.loadEventEnd - navTiming.fetchStart) : null,
  };

  const network = {
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink ? Math.round(connection.downlink * 10) / 10 : undefined,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  };

  const performanceWithMemory = performance as PerformanceWithMemory;
  const memory = performanceWithMemory.memory
    ? {
        used: Math.round(performanceWithMemory.memory.usedJSHeapSize / 1024 / 1024),
        limit: Math.round(performanceWithMemory.memory.jsHeapSizeLimit / 1024 / 1024),
        percentage: (
          (performanceWithMemory.memory.usedJSHeapSize / performanceWithMemory.memory.jsHeapSizeLimit) *
          100
        ).toFixed(1),
      }
    : null;

  const slowResources = performance
    .getEntriesByType('resource')
    .filter((r) => r.duration > 2000)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.split('?')[0].substring(0, 100),
      duration: Math.round(r.duration),
    }));

  const metrics: PerformanceMetrics = {
    network,
    timing,
    memory,
    slowResources,
  };

  const tags: PerformanceTags = {
    connection_quality: getConnectionQuality(timing.ttfb, network.effectiveType, network.rtt),
    page_load_speed: getPageLoadSpeed(timing.domContentLoaded, timing.loadComplete),
    memory_pressure: getMemoryPressure(memory),
    network_type: network.effectiveType || 'unknown',
    has_slow_resources: slowResources.length > 0 ? 'yes' : 'no',
  };

  return { metrics, tags };
}

export function capture(err: ErrorType, context: Context | string = {}): void {
  const parsedContext = scrubSensitive(
    typeof context === 'string' ? JSON.parse(context) : context
  ) as Context;

  if (import.meta.env.VITEST) {
    console.log('capture import.meta.env.VITEST');
    return console.log('capture', err, JSON.stringify(parsedContext, null, 2));
  }
  if (import.meta.env.VITE_ENV !== 'prod' && import.meta.env.VITE_ENV !== 'test') {
    console.log(
      'capture import.meta.env.VITE_ENV !== prod && import.meta.env.VITE_ENV !== test',
      import.meta.env.VITE_ENV
    );
    return console.log('capture', err, parsedContext);
  }

  if (parsedContext.extra && typeof parsedContext.extra === 'object') {
    try {
      const newExtra: Record<string, string> = {};
      for (const [extraKey, extraValue] of Object.entries(parsedContext.extra)) {
        newExtra[extraKey] = typeof extraValue === 'string' ? extraValue : JSON.stringify(extraValue);
      }
      parsedContext.extra = newExtra;
    } catch (e) {
      Sentry.captureMessage(String(e), parsedContext as Record<string, unknown>);
    }
  }

  try {
    const { metrics, tags } = getPerformanceContext();

    if (!parsedContext.contexts) {
      parsedContext.contexts = {};
    }
    parsedContext.contexts.performance = metrics as unknown as Record<string, unknown>;

    if (!parsedContext.tags) {
      parsedContext.tags = {};
    }
    parsedContext.tags = { ...parsedContext.tags, ...tags };
  } catch (e) {
    console.error('Failed to get performance context', e);
  }

  console.log('capture going to Sentry', err, parsedContext);

  if (typeof err === 'string') {
    Sentry.captureMessage(err, parsedContext as Record<string, unknown>);
  } else {
    Sentry.captureException(err, parsedContext as Record<string, unknown>);
  }
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = scrubString(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
  }
  if (event.request) event.request = scrubSensitive(event.request) as ErrorEvent['request'];
  if (event.extra) event.extra = scrubSensitive(event.extra) as ErrorEvent['extra'];
  if (event.contexts) event.contexts = scrubSensitive(event.contexts) as ErrorEvent['contexts'];
  if (event.user) event.user = { id: event.user.id, role: event.user.role };
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubSentryBreadcrumb);
  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message ? scrubString(breadcrumb.message) : breadcrumb.message,
    data: breadcrumb.data ? (scrubSensitive(breadcrumb.data) as Breadcrumb['data']) : breadcrumb.data,
  };
}
