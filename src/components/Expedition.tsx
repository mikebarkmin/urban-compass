import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { City } from "../../game/cities";
import { loadCities } from "@/data/citiesLoader";
import {
  Challenge,
  ExpeditionConfig,
  ExpeditionRun as Run,
  MIN_EXPEDITION_POOL,
  buildPool,
  expeditionRamp,
  loadExpeditionStats,
  newSeed,
  runFromQuery,
  runQuery,
  saveExpeditionStats,
} from "@/utils/expedition";
import { useLocale } from "@/i18n";
import { Button, Panel } from "./ui";
import ExpeditionSetup from "./ExpeditionSetup";
import ExpeditionRun from "./ExpeditionRun";

/** What the screen is currently doing. */
interface Started {
  seed: string;
  config: ExpeditionConfig;
  /** A run picked back up rather than started fresh. */
  restored: Run | null;
  /** The score to beat, when the link that opened this carried one. */
  challenge: Challenge | null;
}

/**
 * The expedition screen. It owns the two things a run needs from outside
 * itself — the gazetteer and the URL — and hands the rest to the setup screen
 * or to the run.
 *
 * The URL is the run: `?r=<seed>&region=…&cards=…` is what the share button
 * copies, and opening one starts that exact expedition. A run in progress is
 * also kept in `localStorage`, so a reload with no query resumes it.
 */
const Expedition = () => {
  const router = useRouter();
  const { t } = useLocale();

  const [cities, setCities] = useState<City[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedMb, setLoadedMb] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Resolved from the URL, then from the saved run. Null until the router is
  // ready, which is also what keeps the first render free of stored state.
  const [started, setStarted] = useState<Started | null>(null);
  const [resolved, setResolved] = useState(false);
  /** The settings the setup screen opens with — the last ones played. */
  const [lastConfig, setLastConfig] = useState<ExpeditionConfig | null>(null);
  /** A saved run waiting to be picked up, offered on the setup screen. */
  const [resumable, setResumable] = useState<Run | null>(null);
  const [bestByRegion, setBestByRegion] = useState<Record<string, number>>({});
  const [bestScoreByRegion, setBestScoreByRegion] = useState<Record<string, number>>({});
  const [summited, setSummited] = useState<string[]>([]);
  const [conquered, setConquered] = useState<string[]>([]);

  // The gazetteer is the same fetch `/sets` makes and is cached for the
  // session, so a player who has already built a set pays nothing here.
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(false);
    loadCities((mb) => live && setLoadedMb(mb)).then((loaded) => {
      if (!live) return;
      setCities(loaded.length > 0 ? loaded : null);
      setLoadError(loaded.length === 0);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  /** Put a run in the address bar, so the link is shareable at any point. */
  const pushRun = useCallback(
    (seed: string, config: ExpeditionConfig) => {
      router.replace({ pathname: "/expedition", query: runQuery(seed, config) }, undefined, {
        shallow: true,
      });
    },
    [router],
  );

  useEffect(() => {
    if (!router.isReady) return;

    const stats = loadExpeditionStats();
    setBestByRegion(stats.bestByRegion);
    setBestScoreByRegion(stats.bestScoreByRegion);
    setSummited(stats.summited);
    setConquered(stats.conquered);

    // A shared link wins: it names a specific run, which is the whole point of
    // sharing it. A saved run is only resumed when the link is the bare page.
    const fromLink = runFromQuery(router.query as Record<string, string | undefined>);
    const live = stats.active && !stats.active.over ? stats.active : null;

    if (fromLink) {
      const sameRun = live && live.seed === fromLink.seed;
      setStarted({ ...fromLink, restored: sameRun ? live : null });
      setLastConfig(fromLink.config);
    } else {
      // The bare page always lands on the setup screen. A saved run is offered
      // there rather than resumed on the spot: arriving at "Expedition" and
      // being dropped into a run you cannot reconfigure is not a choice.
      setResumable(live);
      if (stats.active) setLastConfig(stats.active.config);
    }

    setResolved(true);
  }, [router.isReady, router.query, pushRun]);

  const pool = useMemo(
    () => (cities && started ? buildPool(cities, started.config) : null),
    [cities, started],
  );
  // The floor costs a sweep of the pool, so the ramp is measured once here and
  // handed down rather than recomputed per round.
  const ramp = useMemo(
    () => (pool ? expeditionRamp(pool) : { startKm: 0, floorKm: 0 }),
    [pool],
  );

  const start = (config: ExpeditionConfig) => {
    const seed = newSeed();
    setStarted({ seed, config, restored: null, challenge: null });
    setLastConfig(config);
    pushRun(seed, config);
  };

  const restart = () => {
    if (!started) return;
    const seed = newSeed();
    setStarted({ seed, config: started.config, restored: null, challenge: null });
    pushRun(seed, started.config);
  };

  const reconfigure = () => {
    // Abandoning a run drops it rather than leaving it to be resumed later.
    const stats = loadExpeditionStats();
    saveExpeditionStats({ ...stats, active: null });
    setBestByRegion(stats.bestByRegion);
    setBestScoreByRegion(stats.bestScoreByRegion);
    setSummited(stats.summited);
    setConquered(stats.conquered);
    setResumable(null);
    setStarted(null);
    router.replace({ pathname: "/expedition", query: {} }, undefined, { shallow: true });
  };

  /** Pick the saved run back up, link and all. */
  const resume = () => {
    if (!resumable) return;
    setStarted({
      seed: resumable.seed,
      config: resumable.config,
      restored: resumable,
      challenge: null,
    });
    pushRun(resumable.seed, resumable.config);
  };

  /** Drop the saved run and plan a new one instead. */
  const discard = () => {
    const stats = loadExpeditionStats();
    saveExpeditionStats({ ...stats, active: null });
    setResumable(null);
  };

  if (!resolved) {
    return (
      <div className="panel mt-20 grid place-items-center p-16 text-center text-sm text-chart-400">
        {t("daily.loading")}
      </div>
    );
  }

  if (!started) {
    return (
      <ExpeditionSetup
        cities={cities}
        loading={loading}
        loadedMb={loadedMb}
        loadError={loadError}
        onRetry={() => setAttempt((count) => count + 1)}
        initial={lastConfig}
        bestByRegion={bestByRegion}
        bestScoreByRegion={bestScoreByRegion}
        summited={summited}
        conquered={conquered}
        resumable={resumable}
        onResume={resume}
        onDiscard={discard}
        onStart={start}
      />
    );
  }

  // The pool is only missing while the gazetteer is still on its way, or when a
  // shared link names a region this player's gazetteer cannot fill.
  if (!pool || pool.length < MIN_EXPEDITION_POOL) {
    return (
      <Panel className="mt-6" title={t("expedition.title")}>
        <p className="text-sm text-chart-400">
          {loadError
            ? t("expedition.loadError")
            : !pool
              ? t("expedition.loading", { mb: loadedMb.toFixed(1) })
              : t("expedition.pool.thin")}
        </p>
        {(loadError || pool) && (
          <Button type="button" variant="secondary" className="mt-4" onClick={reconfigure}>
            {t("expedition.change")}
          </Button>
        )}
      </Panel>
    );
  }

  return (
    <ExpeditionRun
      // A new seed is a new run: remount rather than carry the old state over.
      key={started.seed}
      pool={pool}
      ramp={ramp}
      seed={started.seed}
      config={started.config}
      restored={started.restored}
      challenge={started.challenge}
      onRestart={restart}
      onReconfigure={reconfigure}
    />
  );
};

export default Expedition;
