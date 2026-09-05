import Head from "next/head";

import Daily from "@/components/Daily";
import Layout from "@/components/Layout";
import { useT } from "@/i18n";

export default function DailyPage() {
  const t = useT();

  return (
    <>
      <Head>
        <title>{`${t("app.name")} · ${t("daily.title", { number: "" }).replace("#", "").trim()}`}</title>
        <meta name="description" content={t("home.daily.sub")} />
      </Head>

      <Layout>
        <Daily />
      </Layout>
    </>
  );
}
