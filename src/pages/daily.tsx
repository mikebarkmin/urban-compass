import Head from "next/head";
import Link from "next/link";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Layout
        header={
          <Link
            href="/"
            className="text-xs text-chart-500 underline underline-offset-4 transition-colors hover:text-chart-200"
          >
            {t("daily.backToRooms")}
          </Link>
        }
      >
        <Daily />
      </Layout>
    </>
  );
}
