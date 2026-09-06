import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

import CitySetBuilder from "@/components/CitySetBuilder";
import DailyAuthor from "@/components/DailyAuthor";
import Layout from "@/components/Layout";
import SavedSetList from "@/components/SavedSetList";
import { SavedCitySet, loadSavedSets } from "@/data/savedSets";
import { useLocale } from "@/i18n";
import { Glyph } from "@/components/Glyph";

/**
 * The city-set workshop, outside any room. The same builder the lobby uses,
 * plus the saved sets it writes to and the daily authoring panel that draws
 * boards out of them. Nothing here needs a room, so it does not ask for one.
 */
export default function SetsPage() {
  const { t } = useLocale();

  const [savedSets, setSavedSets] = useState<SavedCitySet[]>([]);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
    cities: SavedCitySet["cities"];
  } | null>(null);

  useEffect(() => {
    setSavedSets(loadSavedSets());
  }, []);

  return (
    <>
      <Head>
        <title>{`${t("app.name")} · ${t("sets.title")}`}</title>
        <meta name="description" content={t("sets.lede")} />
      </Head>

      <Layout>
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {t("sets.title")}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-chart-400">{t("sets.lede")}</p>
            </div>
            <Link
              href="/"
              className="text-sm text-chart-400 underline underline-offset-4 hover:text-chart-200"
            >
              <Glyph name="arrow-left" /> {t("daily.backToRooms")}
            </Link>
          </div>

          {/* No `onUpload`: there is no room here to hand a set to, so the
              builder offers only saving and exporting. */}
          <CitySetBuilder
            onSaved={() => setSavedSets(loadSavedSets())}
            editTarget={editTarget}
            onEditComplete={() => {
              setEditTarget(null);
              setSavedSets(loadSavedSets());
            }}
          />

          <SavedSetList
            sets={savedSets}
            onEdit={(set) =>
              setEditTarget({ id: set.id, name: set.name, cities: set.cities })
            }
            onChange={setSavedSets}
          />

          <DailyAuthor />
        </div>
      </Layout>
    </>
  );
}
