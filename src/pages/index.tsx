import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { z } from "zod";

import Game from "@/components/Game";
import Layout from "@/components/Layout";
import { Emoji } from "@/components/Emoji";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { randomRoomCode } from "@/utils";
import { Rich, useLocale } from "@/i18n";
import { CITY_SETS } from "../../game/citySets";

const queryParamsValidator = z.object({
  username: z.string().min(1),
  roomId: z.string().min(1),
});

export default function Home() {
  const router = useRouter();
  const { t } = useLocale();

  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const parsed = queryParamsValidator.safeParse(router.query);
    if (parsed.success) {
      setUsername(parsed.data.username);
      setRoomId(parsed.data.roomId);
      setJoined(true);
      return;
    }

    // An invite link carries the room but not the name.
    const invitedRoom = router.query.roomId;
    if (typeof invitedRoom === "string" && invitedRoom) {
      setRoomId(invitedRoom);
    }
  }, [router.isReady, router.query]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = username.trim();
    const room = roomId.trim().toUpperCase();

    if (!name || !room) {
      setError(t("home.error.missing"));
      return;
    }

    setError(null);
    setUsername(name);
    setRoomId(room);
    setJoined(true);
    router.push({ query: { username: name, roomId: room } }, undefined, { shallow: true });
  };

  const leave = () => {
    setJoined(false);
    router.push({ pathname: "/", query: {} }, undefined, { shallow: true });
  };

  return (
    <>
      <Head>
        <title>{t("app.name")}</title>
        <meta name="description" content={t("home.daily.sub")} />
      </Head>

      <Layout>
        {joined && username && roomId ? (
          <Game username={username} roomId={roomId} onLeave={leave} />
        ) : (
          <div className="grid items-start gap-8 py-6 lg:grid-cols-2 lg:py-12">
            <div className="animate-rise">
              <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
                {/* The highlighted word sits inside the sentence, and German
                    puts it somewhere else, so the split is on the placeholder. */}
                {t("home.title", { word: "\u0000" })
                  .split("\u0000")
                  .flatMap((part, index) =>
                    index === 0
                      ? [part]
                      : [
                          <span key="word" className="text-beacon-400">
                            {t("home.titleWord")}
                          </span>,
                          part,
                        ],
                  )}
              </h1>
              <p className="mt-4 max-w-md text-chart-300">
                <Rich k="home.lede" />
              </p>

              <ul className="mt-8 space-y-3 text-sm text-chart-400">
                {[
                  ["🗺️", t("home.feature.sets", { count: CITY_SETS.length })],
                  ["📍", t("home.feature.upload")],
                  ["🎭", t("home.feature.hidden")],
                ].map(([icon, text]) => (
                  <li key={text} className="flex items-start gap-3">
                    <Emoji symbol={icon} alt="" className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/daily"
                className="mt-8 flex items-center gap-3 rounded-xl border border-chart-700 bg-chart-850/60 px-4 py-3 transition-colors hover:border-beacon-500/60 hover:bg-beacon-500/10"
              >
                <Emoji symbol="📅" alt="" className="h-6 w-6" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-chart-100">
                    {t("home.daily.title")}
                  </span>
                  <span className="block text-xs text-chart-400">{t("home.daily.sub")}</span>
                </span>
                <span className="ml-auto text-chart-500">→</span>
              </Link>
            </div>

            <Panel className="animate-rise" title={t("home.join.title")}>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field label={t("home.field.name")}>
                  <input
                    className={inputClass}
                    value={username}
                    maxLength={24}
                    autoComplete="off"
                    enterKeyHint="next"
                    placeholder={t("home.field.namePlaceholder")}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </Field>

                <Field
                  label={t("home.field.room")}
                  hint={t("home.field.roomHint")}
                >
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} font-display tracking-widest uppercase`}
                      value={roomId}
                      maxLength={12}
                      autoComplete="off"
                      // The field is upper-cased on change anyway; telling the
                      // phone keyboard up front saves a shift-key dance.
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      placeholder={t("home.field.roomPlaceholder")}
                      onChange={(event) => setRoomId(event.target.value.toUpperCase())}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setRoomId(randomRoomCode())}
                    >
                      {t("home.button.new")}
                    </Button>
                  </div>
                </Field>

                {error && <p className="text-xs text-alert-500">{error}</p>}

                <Button type="submit" size="lg" className="w-full">
                  {t("home.button.enter")}
                </Button>
              </form>
            </Panel>
          </div>
        )}
      </Layout>
    </>
  );
}
