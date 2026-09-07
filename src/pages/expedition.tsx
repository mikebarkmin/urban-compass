import Head from "next/head";

import Expedition from "@/components/Expedition";
import Layout from "@/components/Layout";
import { useT } from "@/i18n";

export default function ExpeditionPage() {
  const t = useT();

  return (
    <>
      <Head>
        <title>{`${t("app.name")} · ${t("expedition.title")}`}</title>
        <meta name="description" content={t("expedition.lede")} />
      </Head>

      <Layout>
        <Expedition />
      </Layout>
    </>
  );
}
